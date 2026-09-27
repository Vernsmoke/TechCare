import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { createHash, pbkdf2Sync } from 'node:crypto';
import sharp from 'sharp';
import { schema, db, closeDatabases } from '../src/lib/server/db.mjs';
import { passwordOK } from '../src/lib/server/auth.mjs';
import { migrateLegacy } from '../scripts/migrate-legacy.mjs';
const root = await mkdtemp(join(tmpdir(), 'techcare-migration-')),
  source = join(root, 'legacy'),
  destination = join(root, 'converted');
await mkdir(join(source, 'media'), { recursive: true });
const image = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#123456' } })
  .png()
  .toBuffer();
await writeFile(join(source, 'media', 'old-avatar.png'), image);
const legacy = new DatabaseSync(join(source, 'techcare.sqlite3'));
legacy.exec(schema);
legacy.exec('DROP TABLE migrations; DROP INDEX friendship_pair;');
const salt = '1234567890abcdef1234567890abcdef',
  pw = 'Legacy-test-passphrase';
const hash = `pbkdf2_sha256$310000$${salt}$${pbkdf2Sync(pw, Buffer.from(salt, 'hex'), 310000, 32, 'sha256').toString('hex')}`;
legacy
  .prepare(
    "INSERT INTO users(id,name,email,hash,role,verified,created,avatar,visibility) VALUES(1,'Legacy Admin','admin@example.test',?,'admin',1,1,'','public')",
  )
  .run(hash);
legacy
  .prepare(
    "INSERT INTO users(id,name,email,hash,role,verified,created,avatar,visibility) VALUES(2,'Legacy Member','member@example.test',?,'member',1,1,'/media/old-avatar.png','private')",
  )
  .run(hash);
legacy.exec(
  "INSERT INTO friendships VALUES(1,2,'pending',1),(2,1,'accepted',2); INSERT INTO follows VALUES(1,2); INSERT INTO posts VALUES(19,2,'Legacy question','A detailed legacy question body','General','published',1); INSERT INTO comments VALUES(12,19,1,'A legacy answer','published',2); INSERT INTO messages VALUES(7,1,2,'Private retained history',3); INSERT INTO sessions VALUES('old-session',2,9999999999);",
);
legacy.close();
const digest = async (path) =>
    createHash('sha256')
      .update(await readFile(path))
      .digest('hex'),
  before = await digest(join(source, 'techcare.sqlite3'));
try {
  await test('managed content migration preserves resources and protects their existing uploads', async () => {
    const pilot = join(root, 'content-v1');
    await mkdir(pilot);
    const existing = new DatabaseSync(join(pilot, 'techcare.sqlite3'));
    existing.exec(schema);
    existing
      .prepare(
        "INSERT INTO users(id,name,email,hash,created) VALUES(1,'Pilot Admin','content@example.test',?,1)",
      )
      .run(hash);
    existing.exec(`
      INSERT INTO migrations VALUES(1,1);
      INSERT INTO resources VALUES(15,'Existing resource','Existing description','General','image','/api/media/existing.webp','Original author',42);
      INSERT INTO media VALUES('existing.webp',1,'public','image/webp',42,1);
      INSERT INTO media VALUES('logo.webp',1,'public','image/webp',21,1);
      INSERT INTO settings VALUES('logo','/api/media/logo.webp');
    `);
    existing.close();
    const previous = process.env.TECHCARE_DATA_DIR;
    process.env.TECHCARE_DATA_DIR = pilot;
    try {
      const updated = db();
      const resource = updated.prepare('SELECT * FROM resources WHERE id=15').get();
      assert.equal(resource.title, 'Existing resource');
      assert.equal(resource.url, '/api/media/existing.webp');
      assert.equal(resource.created, 42);
      assert.equal(resource.status, 'published');
      assert.equal(resource.revision, 1);
      assert.equal(
        updated.prepare("SELECT access FROM media WHERE name='existing.webp'").get().access,
        'managed',
      );
      assert.equal(
        updated.prepare("SELECT access FROM media WHERE name='logo.webp'").get().access,
        'public',
      );
      assert.equal(updated.prepare('SELECT count(*) AS n FROM guides').get().n, 4);
      assert.equal(updated.prepare('SELECT count(*) AS n FROM booths').get().n, 1);
      updated.exec("DELETE FROM guides; DELETE FROM booths; UPDATE resources SET status='draft'");
      closeDatabases();
      assert.equal(db().prepare('SELECT count(*) AS n FROM guides').get().n, 0);
      assert.equal(db().prepare('SELECT count(*) AS n FROM booths').get().n, 0);
      assert.equal(db().prepare('SELECT status FROM resources WHERE id=15').get().status, 'draft');
      assert.equal(db().prepare('PRAGMA foreign_key_check').all().length, 0);
    } finally {
      closeDatabases();
      if (previous === undefined) delete process.env.TECHCARE_DATA_DIR;
      else process.env.TECHCARE_DATA_DIR = previous;
    }
  });
  await test('question photo migration preserves version-one posts and existing media and runs once', async () => {
    const pilot = join(root, 'pilot-v1');
    await mkdir(pilot);
    const existing = new DatabaseSync(join(pilot, 'techcare.sqlite3'));
    existing.exec(schema);
    existing
      .prepare(
        "INSERT INTO users(id,name,email,hash,created) VALUES(1,'Pilot User','pilot@example.test',?,1)",
      )
      .run(hash);
    existing.exec(
      "INSERT INTO posts VALUES(7,1,'Existing question','Existing problem description','General','published',1); INSERT INTO media VALUES('existing.webp',1,'public','image/webp',42,1); INSERT INTO migrations VALUES(1,1);",
    );
    existing.close();
    const previous = process.env.TECHCARE_DATA_DIR;
    process.env.TECHCARE_DATA_DIR = pilot;
    try {
      const updated = db();
      assert.equal(updated.prepare('SELECT photo FROM posts WHERE id=7').get().photo, '');
      assert.equal(
        updated.prepare('SELECT body FROM posts WHERE id=7').get().body,
        'Existing problem description',
      );
      assert.deepEqual(
        { ...updated.prepare('SELECT access,bytes FROM media').get() },
        { access: 'public', bytes: 42 },
      );
      updated.exec("INSERT INTO media VALUES('question.webp',1,'question','image/webp',21,1)");
      assert.equal(updated.prepare('PRAGMA foreign_key_check').all().length, 0);
      closeDatabases();
      assert.equal(db().prepare('SELECT count(*) AS n FROM migrations WHERE version=2').get().n, 1);
      assert.equal(db().prepare('SELECT count(*) AS n FROM media').get().n, 2);
      assert.equal(db().prepare('SELECT count(*) AS n FROM migrations WHERE version=3').get().n, 1);
      assert.equal(db().prepare('SELECT count(*) AS n FROM announcements').get().n, 0);
      db().exec("INSERT INTO media VALUES('announcement.webp',1,'announcement','image/webp',21,1)");
    } finally {
      closeDatabases();
      if (previous === undefined) delete process.env.TECHCARE_DATA_DIR;
      else process.env.TECHCARE_DATA_DIR = previous;
    }
  });
  await test('migration preserves source, IDs, password hashes, and logical relationships', async () => {
    const result = await migrateLegacy({
      source,
      destination,
      verification: 'preserve',
      sourceStopped: true,
    });
    assert.equal(result.counts.users, 2);
    assert.equal(result.counts.friendships, 1);
    assert.equal(await digest(join(source, 'techcare.sqlite3')), before);
    const migrated = new DatabaseSync(join(destination, 'techcare.sqlite3'), { readOnly: true });
    assert.equal(
      migrated.prepare('SELECT title FROM posts WHERE id=19').get().title,
      'Legacy question',
    );
    assert.equal(migrated.prepare('SELECT post_id FROM comments WHERE id=12').get().post_id, 19);
    assert.equal(
      migrated.prepare('SELECT body FROM messages WHERE id=7').get().body,
      'Private retained history',
    );
    assert.equal(migrated.prepare('SELECT status FROM friendships').get().status, 'accepted');
    assert.equal(migrated.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
    const user = migrated.prepare('SELECT * FROM users WHERE id=2').get();
    assert.equal(passwordOK(pw, user.hash), true);
    assert.equal(user.verified, 1);
    assert.match(user.avatar, /^\/api\/media\/[a-f0-9]{40}\.webp$/);
    assert.equal(migrated.prepare('SELECT access FROM media').get().access, 'profile');
    assert.equal(migrated.prepare('PRAGMA foreign_key_check').all().length, 0);
    migrated.close();
  });
  await test('migration requires an explicit trust decision and never overwrites output', async () => {
    await assert.rejects(
      migrateLegacy({ source, destination: join(root, 'invalid'), sourceStopped: true }),
      /verification/,
    );
    await assert.rejects(
      migrateLegacy({ source, destination, verification: 'preserve', sourceStopped: true }),
      /must not exist/,
    );
    await assert.rejects(
      migrateLegacy({ source, destination: join(root, 'other'), verification: 'reset' }),
      /Stop the source/,
    );
  });
  await test('reset verification migration creates resumable expired challenges and leaves source unchanged', async () => {
    const dest = join(root, 'reset');
    await migrateLegacy({ source, destination: dest, verification: 'reset', sourceStopped: true });
    const copy = new DatabaseSync(join(dest, 'techcare.sqlite3'), { readOnly: true });
    assert.equal(copy.prepare('SELECT count(*) AS n FROM users WHERE verified=0').get().n, 2);
    assert.equal(
      copy
        .prepare('SELECT count(*) AS n FROM email_verifications WHERE expires=0 AND last_sent=0')
        .get().n,
      2,
    );
    copy.close();
    assert.equal(await digest(join(source, 'techcare.sqlite3')), before);
  });
} finally {
  closeDatabases();
  const child = relative(resolve(tmpdir()), resolve(root));
  if (child.startsWith('techcare-migration-') && !child.includes('..') && !isAbsolute(child))
    await rm(root, { recursive: true, force: true });
}
