import { CONSENT_COOKIE, CONSENT_VERSION } from '../shared/src/consent.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import sharp from 'sharp';
import { handle } from '../backend/src/controllers/api.mjs';
import { run, all, one, now, closeDatabases } from '../backend/src/config/db.mjs';
import { passwordHash } from '../backend/src/middleware/auth.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'techcare-announcements-'));
process.env.TECHCARE_DATA_DIR = temporary;
process.env.TECHCARE_DEV_VERIFY = '1';
const origin = (process.env.TECHCARE_ORIGIN = 'http://127.0.0.1:3014');
const password = 'Announcement-test-password';
const image =
  'data:image/png;base64,' +
  (
    await sharp({ create: { width: 64, height: 40, channels: 3, background: '#0066cc' } })
      .png()
      .toBuffer()
  ).toString('base64');
async function call(path, data, cookie = '') {
  const response = await handle(
    new Request(`${origin}/api/${path}`, {
      method: data ? 'POST' : 'GET',
      headers: {
        cookie: `${cookie}; ${CONSENT_COOKIE}=${CONSENT_VERSION}`,
        ...(data ? { origin, 'content-type': 'application/json', 'x-techcare-request': '1' } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    }),
  );
  return {
    response,
    status: response.status,
    data: response.headers.get('content-type')?.includes('json')
      ? await response.json()
      : await response.arrayBuffer(),
  };
}
const fields = {
  action: 'save',
  title: 'Campus support update',
  description: 'Visit the student support booth.',
  alt: 'A blue announcement image',
  date: '2026-10-16',
  link: 'https://example.org/details',
  status: 'draft',
  file: image,
};
try {
  const sessions = {};
  const hash = passwordHash(password);
  for (const role of ['admin', 'moderator', 'member']) {
    run(
      'INSERT INTO users(name,email,hash,role,verified,created) VALUES(?,?,?,?,1,?)',
      role,
      `${role}@example.test`,
      hash,
      role,
      now(),
    );
    sessions[role] = (
      await call('login', { email: `${role}@example.test`, password })
    ).response.headers
      .get('set-cookie')
      .split(';')[0];
  }
  const admin = sessions.admin;
  const list = async () => (await call('admin/announcements', null, admin)).data.announcements;
  await test('announcement management is admin-only and public list starts empty', async () => {
    assert.deepEqual((await call('announcements')).data.announcements, []);
    for (const [session, status] of [
      ['', 401],
      [sessions.member, 403],
      [sessions.moderator, 403],
    ]) {
      assert.equal((await call('admin/announcements', null, session)).status, status);
      assert.equal((await call('admin/announcements', fields, session)).status, status);
    }
  });
  let first, second;
  await test('drafts and their images stay private until published', async () => {
    assert.equal((await call('admin/announcements', fields, admin)).status, 200);
    [first] = await list();
    assert.equal(first.status, 'draft');
    assert.deepEqual((await call('announcements')).data.announcements, []);
    for (const session of ['', sessions.member, sessions.moderator])
      assert.equal((await call(first.image.slice(5), null, session)).status, 403);
    assert.equal((await call(first.image.slice(5), null, admin)).status, 200);
    assert.equal(
      (
        await call(
          'admin/announcements',
          { action: 'visibility', id: first.id, revision: first.revision, status: 'published' },
          admin,
        )
      ).status,
      200,
    );
    [first] = await list();
    const published = (await call('announcements')).data.announcements[0];
    assert.equal(published.title, fields.title);
    assert.equal(published.revision, undefined);
    assert.equal((await call(first.image.slice(5))).status, 200);
  });
  await test('edits reject stale revisions and validate text, date, link, and images without leaking uploads', async () => {
    const before = one('SELECT count(*) AS n FROM media').n;
    for (const bad of [
      { title: 'x' },
      { alt: '' },
      { date: '2026-02-30' },
      { date: 'wrong' },
      { link: 'javascript:alert(1)' },
      { link: 'https://user:password@example.org' },
      { status: 'other' },
      { file: 'data:image/png;base64,YmFk' },
    ]) {
      assert.equal((await call('admin/announcements', { ...fields, ...bad }, admin)).status, 400);
    }
    assert.equal(one('SELECT count(*) AS n FROM media').n, before);
    assert.equal(
      (await call('admin/announcements', { ...fields, id: first.id, revision: 1 }, admin)).status,
      409,
    );
    assert.equal(
      (await call('admin/announcements', { ...fields, file: undefined }, admin)).status,
      400,
    );
    assert.equal(
      (
        await call(
          'admin/announcements',
          { ...fields, title: 'Second announcement', status: 'published' },
          admin,
        )
      ).status,
      200,
    );
    second = (await list())[1];
  });
  await test('reordering persists, hiding revokes media access, and replacement removes the old image', async () => {
    assert.equal(
      (
        await call(
          'admin/announcements',
          { action: 'move', id: second.id, revision: second.revision, direction: 'up' },
          admin,
        )
      ).status,
      200,
    );
    assert.deepEqual(
      (await call('announcements')).data.announcements.map((item) => item.id),
      [second.id, first.id],
    );
    [second, first] = await list();
    const previousImage = first.image;
    assert.equal(
      (
        await call(
          'admin/announcements',
          {
            ...fields,
            id: first.id,
            revision: first.revision,
            status: 'published',
            title: 'Updated title',
          },
          admin,
        )
      ).status,
      200,
    );
    first = (await list())[1];
    assert.notEqual(first.image, previousImage);
    assert.equal((await call(previousImage.slice(5))).status, 404);
    assert.equal(
      (
        await call(
          'admin/announcements',
          { action: 'visibility', id: first.id, revision: first.revision, status: 'draft' },
          admin,
        )
      ).status,
      200,
    );
    assert.equal((await call(first.image.slice(5))).status, 403);
    first = (await list())[1];
    closeDatabases();
    assert.deepEqual(
      (await list()).map((item) => item.id),
      [second.id, first.id],
    );
  });
  await test('failed database saves clean up uploads; deletion removes only announcement media', async () => {
    const before = one('SELECT count(*) AS n FROM media').n;
    run(
      "CREATE TRIGGER block_announcements BEFORE INSERT ON announcements BEGIN SELECT RAISE(ABORT,'test failure'); END",
    );
    assert.notEqual((await call('admin/announcements', fields, admin)).status, 200);
    run('DROP TRIGGER block_announcements');
    assert.equal(one('SELECT count(*) AS n FROM media').n, before);
    for (const item of await list()) {
      assert.equal(
        (
          await call(
            'admin/announcements',
            { action: 'delete', id: item.id, revision: item.revision },
            admin,
          )
        ).status,
        200,
      );
      assert.equal((await call(item.image.slice(5), null, admin)).status, 404);
    }
    assert.deepEqual((await call('announcements')).data.announcements, []);
    assert.equal(one("SELECT count(*) AS n FROM media WHERE access='announcement'").n, 0);
    assert.equal(all("SELECT * FROM audit WHERE kind='announcement'").length > 0, true);
  });
  await test('campus presets are allowlisted, replace uploads safely, and remain reusable after deletion', async () => {
    assert.equal(
      (await call('admin/announcements', { ...fields, file: '', campusImage: '../outside' }, admin))
        .status,
      400,
    );
    assert.equal((await call('admin/announcements', fields, admin)).status, 200);
    let [item] = await list();
    const oldImage = item.image;
    assert.equal(
      (
        await call(
          'admin/announcements',
          {
            ...fields,
            file: '',
            campusImage: 'campus-building',
            status: 'published',
            id: item.id,
            revision: item.revision,
          },
          admin,
        )
      ).status,
      200,
    );
    [item] = await list();
    assert.equal(item.image, '/static/campus/campus-building.webp');
    assert.equal((await call(oldImage.slice(5), null, admin)).status, 404);
    assert.equal((await call('announcements')).data.announcements[0].image, item.image);
    assert.equal(
      (
        await call(
          'admin/announcements',
          { action: 'delete', id: item.id, revision: item.revision },
          admin,
        )
      ).status,
      200,
    );
    for (const campusImage of ['campus-building', 'covered-walkway', 'dormitory-courtyard']) {
      assert.equal(
        (await call('admin/announcements', { ...fields, file: '', campusImage }, admin)).status,
        200,
      );
    }
    [item] = await list();
    assert.equal(
      (
        await call(
          'admin/announcements',
          { ...fields, id: item.id, revision: item.revision },
          admin,
        )
      ).status,
      200,
    );
    assert.match((await list())[0].image, /^\/api\/media\//);
  });
} finally {
  closeDatabases();
  const child = relative(tmpdir(), temporary);
  if (child.startsWith('techcare-announcements-') && !child.includes('..') && !isAbsolute(child))
    await rm(temporary, { recursive: true, force: true });
}
