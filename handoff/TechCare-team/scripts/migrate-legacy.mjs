import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { schema, db, all, run, now, closeDatabases } from '../src/lib/server/db.mjs';
import { saveMedia } from '../src/lib/server/media.mjs';
import { passwordHash, secret } from '../src/lib/server/auth.mjs';

// Always migrates a new copy. The source must be stopped for database/media consistency.
export async function migrateLegacy({ source, destination, verification, sourceStopped = false }) {
  if (!sourceStopped) throw new Error('Stop the source app first, then pass --source-stopped.');
  if (!['preserve', 'reset'].includes(verification))
    throw new Error('Choose --verification preserve or reset explicitly.');
  const sourceDir = resolve(source),
    dest = resolve(destination);
  if (await stat(dest).catch(() => null))
    throw new Error('Destination must not exist. Migration never overwrites data.');
  const original = new DatabaseSync(join(sourceDir, 'techcare.sqlite3'), { readOnly: true });
  if (original.prepare("SELECT name FROM sqlite_master WHERE name='migrations'").get()) {
    original.close();
    throw new Error(
      'This is already a versioned database. Use the normal backup/restore procedure.',
    );
  }
  const columns = original
    .prepare('PRAGMA table_info(users)')
    .all()
    .map((r) => r.name);
  if (!columns.includes('verified') && verification === 'preserve') {
    original.close();
    throw new Error('Source has no verification state. Select reset and reverify accounts.');
  }
  const staging = dest + '.migrating-' + randomUUID();
  await mkdir(staging, { recursive: true });
  const previous = process.env.TECHCARE_DATA_DIR;
  try {
    await backup(original, join(staging, 'techcare.sqlite3'));
    original.close();
    const copy = new DatabaseSync(join(staging, 'techcare.sqlite3'));
    try {
      copy.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;');
      if (!columns.includes('visibility'))
        copy.exec("ALTER TABLE users ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'");
      if (!columns.includes('verified'))
        copy.exec('ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0');
      // Merge only duplicate inverse relationships, retaining accepted state if either side accepted.
      const duplicates = copy
        .prepare(
          'SELECT min(sender,receiver) AS a,max(sender,receiver) AS b,count(*) AS n FROM friendships GROUP BY a,b HAVING n>1',
        )
        .all();
      for (const pair of duplicates) {
        const entries = copy
          .prepare(
            'SELECT * FROM friendships WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?) ORDER BY created,sender',
          )
          .all(pair.a, pair.b, pair.b, pair.a);
        const keeper = entries[0],
          status = entries.some((e) => e.status === 'accepted') ? 'accepted' : 'pending';
        copy
          .prepare(
            'DELETE FROM friendships WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?)',
          )
          .run(pair.a, pair.b, pair.b, pair.a);
        copy
          .prepare('INSERT INTO friendships VALUES(?,?,?,?)')
          .run(keeper.sender, keeper.receiver, status, keeper.created);
      }
      copy.exec(schema);
      copy.prepare('INSERT OR IGNORE INTO migrations VALUES(1,?)').run(now());
      if (verification === 'reset') {
        copy.exec('UPDATE users SET verified=0; DELETE FROM email_verifications;');
        const expiredHash = passwordHash(secret());
        for (const u of copy.prepare('SELECT id FROM users').all())
          copy.prepare('INSERT INTO email_verifications VALUES(?,?,0,0,0)').run(u.id, expiredHash);
      }
      copy.exec('DELETE FROM sessions; COMMIT;');
      if (copy.prepare('PRAGMA foreign_key_check').all().length)
        throw new Error(
          'Source has broken relationships. Repair a separate copy before migration.',
        );
    } finally {
      copy.close();
    }
    process.env.TECHCARE_DATA_DIR = staging;
    const admin = all("SELECT id FROM users WHERE role='admin' ORDER BY id")[0];
    const owner = admin?.id || all('SELECT id FROM users ORDER BY id')[0]?.id;
    async function importFile(url, ownerId, access, video = false) {
      if (!url.startsWith('/media/')) return url;
      const name = url.slice(7);
      if (!name || name !== basename(name) || name.includes('..'))
        throw new Error('Unsafe legacy media path.');
      const extension = name.split('.').pop().toLowerCase(),
        mime = {
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          webp: 'image/webp',
          mp4: 'video/mp4',
          webm: 'video/webm',
        }[extension];
      if (!mime) throw new Error('Unsupported legacy media file.');
      const bytes = await readFile(join(sourceDir, 'media', name));
      return saveMedia(`data:${mime};base64,${bytes.toString('base64')}`, ownerId, access, video);
    }
    for (const u of all("SELECT id,avatar FROM users WHERE avatar!=''"))
      run(
        'UPDATE users SET avatar=? WHERE id=?',
        await importFile(u.avatar, u.id, 'profile'),
        u.id,
      );
    for (const r of all("SELECT id,url,type FROM resources WHERE type IN ('image','video')"))
      run(
        'UPDATE resources SET url=? WHERE id=?',
        await importFile(r.url, owner, 'public', r.type === 'video'),
        r.id,
      );
    const hero = all("SELECT value FROM settings WHERE key='hero'")[0];
    if (hero)
      run(
        "UPDATE settings SET value=? WHERE key='hero'",
        await importFile(hero.value, owner, 'public'),
      );
    const counts = Object.fromEntries(
      [
        'users',
        'posts',
        'comments',
        'follows',
        'friendships',
        'messages',
        'resources',
        'lost_found',
        'feedback',
      ].map((table) => [table, db().prepare(`SELECT count(*) AS n FROM ${table}`).get().n]),
    );
    db().exec('PRAGMA wal_checkpoint(TRUNCATE)');
    closeDatabases();
    await writeFile(
      join(staging, 'migration-report.json'),
      JSON.stringify(
        {
          version: 1,
          verification,
          counts,
          sourceUnchanged: true,
          sessionsRevoked: true,
          finished: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    // Destination is new, fully prepared, and explicitly supplied. Rename stays within its parent.
    await rename(staging, dest);
    return { counts, destination: dest };
  } catch (error) {
    try {
      original.close();
    } catch {}
    closeDatabases();
    throw new Error(
      `Migration stopped without changing the source. A partial copy remains at ${staging}. ${error.message}`,
    );
  } finally {
    if (previous === undefined) delete process.env.TECHCARE_DATA_DIR;
    else process.env.TECHCARE_DATA_DIR = previous;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2),
    value = (name) => args[args.indexOf(name) + 1];
  if (!args.includes('--source') || !args.includes('--dest'))
    throw new Error(
      'Usage: node scripts/migrate-legacy.mjs --source <old-data-dir> --dest <new-data-dir> --verification preserve|reset --source-stopped',
    );
  console.log(
    await migrateLegacy({
      source: value('--source'),
      destination: value('--dest'),
      verification: value('--verification'),
      sourceStopped: args.includes('--source-stopped'),
    }),
  );
}
