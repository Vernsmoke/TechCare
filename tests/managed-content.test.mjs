import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import sharp from 'sharp';
import { handle } from '../src/app/api/handlers.mjs';
import { run, one, now, closeDatabases } from '../src/lib/server/db.mjs';
import { passwordHash } from '../src/lib/server/auth.mjs';
import { guides, defaultBooth } from '../src/lib/content-defaults.mjs';
import { initializeTestDatabase } from './mysql-test-db.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'techcare-content-'));
process.env.TECHCARE_MEDIA_DIR = temporary;
const cleanupDatabase = await initializeTestDatabase();
process.env.TECHCARE_DEV_VERIFY = '1';
const origin = (process.env.TECHCARE_ORIGIN = 'http://127.0.0.1:3015');
const password = 'Content-test-password';
const image =
  'data:image/png;base64,' +
  (
    await sharp({ create: { width: 64, height: 40, channels: 3, background: '#2468ac' } })
      .png()
      .toBuffer()
  ).toString('base64');
async function call(path, data, cookie = '') {
  const response = await handle(
    new Request(`${origin}/api/${path}`, {
      method: data ? 'POST' : 'GET',
      headers: {
        cookie,
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
const guideFields = {
  ...guides[0],
  id: undefined,
  action: 'save',
  status: 'draft',
  title: 'A new managed guide',
};
const boothFields = {
  ...defaultBooth,
  action: 'save',
  status: 'draft',
  title: 'New campus support event',
};
const mediaFields = {
  action: 'save',
  title: 'New learning resource',
  description: 'Helpful media.',
  category: 'General',
  type: 'external',
  url: 'https://example.org/tutorial',
  author: 'TechCare',
  status: 'draft',
};
try {
  const sessions = {},
    hash = passwordHash(password);
  for (const role of ['admin', 'moderator', 'member']) {
    await run(
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
  const list = async (kind) => (await call(`admin/${kind}`, null, admin)).data[kind];
  const save = (kind, fields) => call(`admin/${kind}`, fields, admin);
  await test('existing page content is seeded once and publication is admin-only', async () => {
    assert.equal((await call('guides')).data.guides.length, 4);
    assert.equal((await call('booths')).data.booths[0].venue, defaultBooth.venue);
    for (const [kind, fields] of [
      ['guides', guideFields],
      ['resources', mediaFields],
      ['booths', boothFields],
    ]) {
      for (const [session, status] of [
        ['', 401],
        [sessions.member, 403],
        [sessions.moderator, 403],
      ]) {
        assert.equal((await call(`admin/${kind}`, null, session)).status, status);
        for (const action of ['save', 'visibility', 'delete'])
          assert.equal(
            (await call(`admin/${kind}`, { ...fields, action, id: 1, revision: 1 }, session))
              .status,
            status,
          );
      }
    }
    await closeDatabases();
    assert.equal((await list('guides')).length, 4);
  });
  await test('guide creation, editing, publishing, conflict protection, hiding and deletion persist', async () => {
    const created = await save('guides', guideFields);
    assert.equal(created.status, 200);
    let row = (await list('guides')).find((item) => item.id === created.data.id);
    assert.equal(
      (await call('guides')).data.guides.some((item) => item.id === row.id),
      false,
    );
    assert.equal(
      (
        await save('guides', {
          ...row,
          action: 'save',
          title: 'Updated guide title',
          steps: 'First updated step\nSecond updated step',
          status: 'published',
        })
      ).status,
      200,
    );
    assert.equal((await save('guides', { ...row, action: 'delete' })).status, 409);
    row = (await list('guides')).find((item) => item.id === row.id);
    const publicRow = (await call('guides')).data.guides.find((item) => item.id === row.id);
    assert.deepEqual(publicRow.steps, ['First updated step', 'Second updated step']);
    assert.equal(publicRow.revision, undefined);
    assert.equal(
      (await save('guides', { ...row, action: 'visibility', status: 'draft' })).status,
      200,
    );
    row = (await list('guides')).find((item) => item.id === row.id);
    assert.equal(
      (await call('guides')).data.guides.some((item) => item.id === row.id),
      false,
    );
    assert.equal((await save('guides', { ...row, action: 'delete' })).status, 200);
    await closeDatabases();
    assert.equal(
      (await list('guides')).some((item) => item.id === row.id),
      false,
    );
    const replacement = await save('guides', guideFields);
    assert.notEqual(replacement.data.id, row.id);
    assert.equal((await save('guides', { ...row, action: 'save' })).status, 404);
  });
  await test('draft media is private, replacement cleans uploads, and hiding revokes media access', async () => {
    const created = await save('resources', { ...mediaFields, type: 'image', file: image });
    let row = (await list('resources')).find((item) => item.id === created.data.id);
    for (const session of ['', sessions.member, sessions.moderator])
      assert.equal((await call(row.url.slice(5), null, session)).status, 403);
    assert.equal((await call(row.url.slice(5), null, admin)).status, 200);
    assert.equal(
      (await save('resources', { ...row, action: 'save', file: image, status: 'published' }))
        .status,
      200,
    );
    assert.equal((await call(row.url.slice(5), null, admin)).status, 404);
    row = (await list('resources')).find((item) => item.id === row.id);
    assert.equal((await call(row.url.slice(5))).status, 200);
    assert.equal(
      (await call('resources?type=image')).data.resources.some((item) => item.id === row.id),
      true,
    );
    assert.equal(
      (await call('resources?type=video')).data.resources.some((item) => item.id === row.id),
      false,
    );
    assert.equal(
      (await save('resources', { ...row, action: 'visibility', status: 'draft' })).status,
      200,
    );
    assert.equal((await call(row.url.slice(5))).status, 403);
    assert.equal(
      (await call('resources')).data.resources.some((item) => item.id === row.id),
      false,
    );
    row = (await list('resources')).find((item) => item.id === row.id);
    assert.equal((await save('resources', { ...row, action: 'delete' })).status, 200);
    assert.equal((await call(row.url.slice(5), null, admin)).status, 404);
  });
  await test('booth fields, custom images, campus presets and public visibility stay in sync', async () => {
    const created = await save('booths', { ...boothFields, file: image });
    let row = (await list('booths')).find((item) => item.id === created.data.id);
    assert.equal((await call(row.image.slice(5))).status, 403);
    assert.equal(
      (
        await save('booths', {
          ...row,
          action: 'save',
          status: 'published',
          venue: 'Library lobby',
          hours: '9 AM – 3 PM',
          date: '2027-02-20',
          preparation: [],
          campusImage: 'campus-building',
        })
      ).status,
      200,
    );
    assert.equal((await call(row.image.slice(5), null, admin)).status, 404);
    row = (await list('booths')).find((item) => item.id === row.id);
    const publicRow = (await call('booths')).data.booths.find((item) => item.id === row.id);
    assert.equal(publicRow.venue, 'Library lobby');
    assert.equal(publicRow.date, '2027-02-20');
    assert.equal(publicRow.image, '/static/campus/campus-building.webp');
    assert.deepEqual(publicRow.preparation, []);
    assert.equal(
      (await save('booths', { ...row, action: 'visibility', status: 'draft' })).status,
      200,
    );
    assert.equal(
      (await call('booths')).data.booths.some((item) => item.id === row.id),
      false,
    );
    row = (await list('booths')).find((item) => item.id === row.id);
    assert.equal((await save('booths', { ...row, action: 'delete' })).status, 200);
  });
  await test('invalid content and unsafe links are rejected before saving', async () => {
    for (const [kind, fields] of [
      ['guides', { ...guideFields, steps: [] }],
      ['guides', { ...guideFields, icon: 'unknown' }],
      ['guides', { ...guideFields, title: 'x'.repeat(121) }],
      ['resources', { ...mediaFields, url: 'javascript:alert(1)' }],
      ['resources', { ...mediaFields, type: 'image', file: 'invalid' }],
      ['booths', { ...boothFields, date: '2027-02-30' }],
      ['booths', { ...boothFields, campusImage: '../../etc' }],
    ])
      assert.equal((await save(kind, fields)).status, 400);
    assert.equal(
      (await save('guides', { action: 'visibility', id: 99999, revision: 1, status: 'published' }))
        .status,
      404,
    );
  });
  await test('moderator resource creation remains available without granting editing privileges', async () => {
    const created = await call('resource', mediaFields, sessions.moderator);
    assert.equal(created.status, 201);
    const row = (await list('resources')).find((item) => item.id === created.data.id);
    assert.equal(row.status, 'published');
    assert.equal(
      (
        await call(
          'resource',
          { ...mediaFields, id: row.id, revision: row.revision },
          sessions.moderator,
        )
      ).status,
      403,
    );
    assert.equal(
      (await call('admin/resources', { ...row, action: 'delete' }, sessions.moderator)).status,
      403,
    );
  });
  await test('failed saves roll back content and clean up new uploads', async () => {
    const count = (await one('SELECT count(*) AS n FROM media')).n;
    await run(
      "CREATE TRIGGER reject_managed_audit BEFORE INSERT ON audit FOR EACH ROW BEGIN IF NEW.kind='booths' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='forced test failure'; END IF; END",
    );
    assert.equal((await save('booths', { ...boothFields, file: image })).status, 500);
    await run('DROP TRIGGER reject_managed_audit');
    assert.equal((await one('SELECT count(*) AS n FROM media')).n, count);
    assert.equal((await list('booths')).length, 1);
  });
} finally {
  await cleanupDatabase();
  const child = relative(tmpdir(), temporary);
  if (child.startsWith('techcare-content-') && !child.includes('..') && !isAbsolute(child))
    await rm(temporary, { recursive: true, force: true });
}
