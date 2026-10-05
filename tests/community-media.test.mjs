import { CONSENT_COOKIE, CONSENT_VERSION } from '../shared/src/consent.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import sharp from 'sharp';
import { handle } from '../backend/src/controllers/api.mjs';
import { run, one, now, closeDatabases } from '../backend/src/config/db.mjs';
import { passwordHash } from '../backend/src/middleware/auth.mjs';

const directory = await mkdtemp(join(tmpdir(), 'techcare-community-media-'));
process.env.TECHCARE_DATA_DIR = directory;
process.env.TECHCARE_DEV_VERIFY = '1';
const origin = (process.env.TECHCARE_ORIGIN = 'http://127.0.0.1:3021');
const photo =
  'data:image/png;base64,' +
  (
    await sharp({ create: { width: 24, height: 24, channels: 3, background: '#2478ab' } })
      .png()
      .toBuffer()
  ).toString('base64');
async function call(path, data, cookie = '') {
  const response = await handle(
    new Request(origin + '/api/' + path, {
      method: data ? 'POST' : 'GET',
      headers: {
        cookie: `${cookie}; ${CONSENT_COOKIE}=${CONSENT_VERSION}`,
        ...(data ? { origin, 'content-type': 'application/json', 'x-techcare-request': '1' } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    }),
  );
  return {
    status: response.status,
    data: response.headers.get('content-type')?.includes('json') ? await response.json() : {},
    response,
  };
}
try {
  const sessions = {},
    ids = {},
    password = 'Synthetic-media-check-password';
  for (const role of ['admin', 'member', 'other']) {
    ids[role] = Number(
      run(
        'INSERT INTO users(name,email,hash,role,verified,created) VALUES(?,?,?,?,1,?)',
        role,
        role + '@example.test',
        passwordHash(password),
        role === 'admin' ? 'admin' : 'member',
        now(),
      ).lastInsertRowid,
    );
    sessions[role] = (
      await call('login', { email: role + '@example.test', password })
    ).response.headers
      .get('set-cookie')
      .split(';')[0];
  }
  run(
    "INSERT INTO posts(id,user_id,title,body,category,status,created) VALUES(1,?,'Published question','A helpful question about laptops.','General','published',1),(2,?,'Other question','A different helpful question.','General','published',2)",
    ids.member,
    ids.other,
  );
  let root, reply, nested, lost;
  await test('guide step images stay private in drafts, publish together and reject foreign media', async () => {
    const draft = {
      action: 'save',
      title: 'A guide with images',
      summary: 'Clear instructions with a helpful photo.',
      category: 'General',
      time: '3 min read',
      icon: 'desktop',
      steps: ['Open the settings panel.', 'Choose the network tab.'],
      images: [{ step: 1, alt: 'The settings panel', file: photo }],
      status: 'draft',
    };
    const saved = await call('admin/guides', draft, sessions.admin);
    assert.equal(saved.status, 200);
    let guide = (await call('admin/guides', null, sessions.admin)).data.guides.find(
      (g) => g.id === saved.data.id,
    );
    const url = guide.images[0].url;
    assert.equal((await call(url.slice(5))).status, 403);
    assert.equal(
      (
        await call(
          'admin/guides',
          {
            ...draft,
            images: [{ step: 2, alt: 'Forged attachment', url: '/api/media/forged.webp' }],
          },
          sessions.admin,
        )
      ).status,
      400,
    );
    await call(
      'admin/guides',
      { action: 'visibility', id: guide.id, revision: guide.revision, status: 'published' },
      sessions.admin,
    );
    assert.equal((await call(url.slice(5))).status, 200);
    guide = (await call('admin/guides', null, sessions.admin)).data.guides.find(
      (g) => g.id === saved.data.id,
    );
    await call(
      'admin/guides',
      { ...draft, id: guide.id, revision: guide.revision, images: [], status: 'published' },
      sessions.admin,
    );
    assert.equal((await call(url.slice(5))).status, 404);
  });
  await test('resource links accept arbitrary HTTPS sites and cover photos follow publication', async () => {
    const saved = await call(
      'admin/resources',
      {
        action: 'save',
        title: 'A useful reference',
        description: 'An article for the community.',
        category: 'General',
        type: 'external',
        url: 'https://example.com/article',
        author: 'Reference author',
        coverFile: photo,
        status: 'draft',
      },
      sessions.admin,
    );
    assert.equal(saved.status, 200);
    const entry = (await call('admin/resources', null, sessions.admin)).data.resources.find(
      (r) => r.id === saved.data.id,
    );
    assert.equal((await call(entry.cover.slice(5))).status, 403);
    await call(
      'admin/resources',
      { action: 'visibility', id: entry.id, revision: entry.revision, status: 'published' },
      sessions.admin,
    );
    assert.equal((await call(entry.cover.slice(5))).status, 200);
    assert.equal(
      (await call('resources')).data.resources.find((r) => r.id === entry.id).cover,
      entry.cover,
    );
  });
  await test('comment photos require approval and notify the parent author only after publication', async () => {
    root = (
      await call(
        'comments',
        { post_id: 1, body: 'Try checking the network settings.' },
        sessions.admin,
      )
    ).data.id;
    const result = await call(
      'comments',
      { post_id: 1, parent_id: root, body: 'Here is what I see.', file: photo },
      sessions.member,
    );
    assert.equal(result.status, 201);
    reply = result.data.id;
    const row = one('SELECT * FROM comments WHERE id=?', reply);
    assert.equal(row.status, 'pending');
    assert.equal((await call(row.photo.slice(5))).status, 403);
    assert.equal((await call(row.photo.slice(5), null, sessions.member)).status, 200);
    assert.equal((await call('notifications', null, sessions.admin)).data.notifications.length, 0);
    assert.equal(
      (
        await call(
          'comments',
          { post_id: 2, parent_id: root, body: 'Invalid parent.' },
          sessions.admin,
        )
      ).status,
      404,
    );
    await call('moderate', { kind: 'comment', id: reply, status: 'published' }, sessions.admin);
    assert.equal((await call(row.photo.slice(5))).status, 200);
    assert.equal((await call('notifications', null, sessions.admin)).data.notifications.length, 1);
    const page = (await call('comments?post=1')).data;
    assert.equal(page.comments.length, 1);
    assert.equal(page.comments[0].replies, 1);
    assert.equal((await call('comments?post=1&root=' + root)).data.comments[0].id, reply);
  });
  await test('replies to replies stay in the root thread, paginate and protect hidden roots', async () => {
    nested = (
      await call(
        'comments',
        { post_id: 1, parent_id: reply, body: 'Thanks for sharing the photo.' },
        sessions.admin,
      )
    ).data.id;
    assert.equal(one('SELECT root_id FROM comments WHERE id=?', nested).root_id, root);
    assert.equal((await call('notifications', null, sessions.member)).data.notifications.length, 1);
    for (let i = 0; i < 22; i++)
      run(
        "INSERT INTO comments(post_id,user_id,body,status,created,parent_id,root_id) VALUES(1,?,'Additional reply','published',?,?,?)",
        ids.admin,
        now() + i,
        root,
        root,
      );
    assert.equal((await call('comments?post=1&root=' + root)).data.hasMore, true);
    assert.equal((await call('comments?post=1&root=' + root + '&page=2')).data.comments.length, 4);
    run("UPDATE comments SET status='rejected' WHERE id=?", root);
    assert.equal((await call('comments?post=1&root=' + root)).status, 404);
    assert.equal(
      (await call(one('SELECT photo FROM comments WHERE id=?', reply).photo.slice(5))).status,
      403,
    );
    assert.equal(
      (await call('vote', { kind: 'comment', id: nested, value: 1 }, sessions.member)).status,
      404,
    );
    run("UPDATE comments SET status='published' WHERE id=?", root);
  });
  await test('authors can edit and remove comments; others cannot and stale edits fail', async () => {
    const row = one('SELECT * FROM comments WHERE id=?', reply);
    assert.equal(
      (
        await call(
          'comments',
          { id: reply, revision: row.revision, body: 'Someone else edit.' },
          sessions.other,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          'comments',
          { id: reply, revision: row.revision, body: 'Updated explanation.' },
          sessions.member,
        )
      ).status,
      201,
    );
    assert.equal(one('SELECT status FROM comments WHERE id=?', reply).status, 'pending');
    assert.equal(
      (
        await call(
          'comments',
          { id: reply, revision: row.revision, body: 'Stale edit.' },
          sessions.member,
        )
      ).status,
      409,
    );
    await call('moderate', { kind: 'comment', id: reply, status: 'published' }, sessions.admin);
    assert.equal(
      (
        await call(
          'comments',
          { id: reply, revision: row.revision + 1, action: 'delete' },
          sessions.member,
        )
      ).status,
      201,
    );
    assert.equal((await call(row.photo.slice(5))).status, 404);
    assert.equal(one('SELECT deleted FROM comments WHERE id=?', reply).deleted, 1);
    assert.ok(one('SELECT 1 FROM comments WHERE id=?', nested));
    assert.equal(
      (await call('vote', { kind: 'comment', id: reply, value: 1 }, sessions.admin)).status,
      404,
    );
  });
  await test('lost/found photos are moderated, private inquiries support replies, and returned filtering works', async () => {
    const result = await call(
      'lost-found',
      {
        kind: 'lost',
        item: 'Blue laptop sleeve',
        details: 'A blue fabric sleeve left near the library.',
        location: 'Library entrance',
        event_date: '2026-09-30',
        photo0: photo,
        photo1: photo,
      },
      sessions.member,
    );
    assert.equal(result.status, 201);
    lost = result.data.id;
    const row = one('SELECT * FROM lost_found WHERE id=?', lost),
      url = JSON.parse(row.photos)[0];
    assert.equal((await call(url.slice(5))).status, 403);
    await call('moderate', { kind: 'report', id: lost, status: 'published' }, sessions.admin);
    assert.equal((await call(url.slice(5))).status, 200);
    const publicRow = (await call('lost-found')).data.reports[0];
    assert.equal(publicRow.photos.length, 2);
    assert.equal(publicRow.user_id, undefined);
    assert.equal(
      (
        await call(
          'item-inquiries',
          { id: lost, body: 'I found a sleeve matching this description.' },
          sessions.other,
        )
      ).status,
      200,
    );
    const inquiry = (await call('item-inquiries', null, sessions.member)).data.inquiries[0];
    assert.equal(inquiry.canReply, 1);
    assert.equal(
      (
        await call(
          'item-inquiries/reply',
          { id: inquiry.id, response: 'Please leave it with the project team.' },
          sessions.other,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          'item-inquiries/reply',
          { id: inquiry.id, response: 'Please leave it with the project team.' },
          sessions.member,
        )
      ).status,
      200,
    );
    assert.match(
      (await call('item-inquiries', null, sessions.other)).data.inquiries[0].response,
      /project team/,
    );
    assert.equal((await call('lost-found/returned', { id: lost }, sessions.other)).status, 403);
    assert.equal((await call('lost-found/returned', { id: lost }, sessions.member)).status, 200);
    assert.equal((await call('lost-found?kind=lost')).data.reports.length, 0);
    assert.equal((await call('lost-found?kind=returned')).data.reports[0].id, lost);
  });
  await test('content reports are staff-only and removal revokes public access', async () => {
    assert.equal(
      (
        await call(
          'content-reports',
          { kind: 'post', id: 2, reason: 'Please review these instructions.' },
          sessions.member,
        )
      ).status,
      200,
    );
    assert.equal((await call('content-reports', null, sessions.member)).status, 403);
    const report = (await call('content-reports', null, sessions.admin)).data.reports[0];
    assert.equal(
      (await call('content-reports/resolve', { id: report.id, action: 'remove' }, sessions.member))
        .status,
      403,
    );
    assert.equal(
      (await call('content-reports/resolve', { id: report.id, action: 'remove' }, sessions.admin))
        .status,
      200,
    );
    assert.equal((await call('post?id=2')).status, 404);
    assert.equal((await call('content-reports', null, sessions.admin)).data.reports.length, 0);
    closeDatabases();
    assert.equal(one('SELECT count(*) AS n FROM pragma_foreign_key_check').n, 0);
    assert.equal(one('SELECT count(*) AS n FROM migrations WHERE version=7').n, 1);
  });
} finally {
  closeDatabases();
  const child = relative(tmpdir(), directory);
  if (child.startsWith('techcare-community-media-') && !child.includes('..') && !isAbsolute(child))
    await rm(directory, { recursive: true, force: true });
}
