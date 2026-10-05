import { CONSENT_COOKIE, CONSENT_VERSION } from '../shared/src/consent.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import { handle } from '../backend/src/controllers/api.mjs';
import { run, one, now, closeDatabases } from '../backend/src/config/db.mjs';
import { passwordHash } from '../backend/src/middleware/auth.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'techcare-discussion-'));
process.env.TECHCARE_DATA_DIR = temporary;
process.env.TECHCARE_DEV_VERIFY = '1';
const origin = (process.env.TECHCARE_ORIGIN = 'http://127.0.0.1:3017');
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
  return { status: response.status, response, data: await response.json() };
}
try {
  const sessions = {},
    ids = {},
    pw = 'Synthetic-discussion-password',
    hash = passwordHash(pw);
  for (const role of ['member', 'admin', 'moderator']) {
    ids[role] = Number(
      run(
        'INSERT INTO users(name,email,hash,role,verified,created) VALUES(?,?,?,?,1,?)',
        role,
        `${role}@example.test`,
        hash,
        role,
        now(),
      ).lastInsertRowid,
    );
    sessions[role] = (
      await call('login', { email: `${role}@example.test`, password: pw })
    ).response.headers
      .get('set-cookie')
      .split(';')[0];
  }
  for (let i = 1; i <= 25; i++)
    run(
      "INSERT INTO posts(id,user_id,title,body,category,status,created) VALUES(?,?,?,?,?,'published',?)",
      i,
      ids.member,
      `Question number ${i}`,
      'A detailed question from the community.',
      'General',
      i,
    );
  run(
    "INSERT INTO posts(id,user_id,title,body,category,status,created) VALUES(26,?,'Hidden question','Not approved yet.','General','pending',26)",
    ids.member,
  );
  run(
    "INSERT INTO comments(id,post_id,user_id,body,status,created) VALUES(1,1,?,'Approved answer','published',1),(2,1,?,'Pending answer','pending',2),(3,26,?,'Hidden parent answer','published',3)",
    ids.admin,
    ids.member,
    ids.admin,
  );
  await test('direct question links work beyond the first page and exclude unpublished content', async () => {
    assert.equal(
      (await call('posts')).data.posts.some((p) => p.id === 1),
      false,
    );
    assert.equal((await call('post?id=1')).data.post.title, 'Question number 1');
    assert.equal((await call('post?id=1')).data.post.replies, 1);
    for (const session of ['', sessions.member, sessions.admin])
      assert.equal((await call('post?id=26', null, session)).status, 404);
    assert.equal((await call('post?id=9999')).status, 404);
    assert.equal((await call('post?id=bad')).status, 400);
  });
  await test('votes require sign-in and published targets; malformed and cross-origin writes fail', async () => {
    const vote = { kind: 'post', id: 1, value: 1 };
    assert.equal((await call('vote', vote)).status, 401);
    for (const value of [2, -2, '1', null])
      assert.equal((await call('vote', { ...vote, value }, sessions.member)).status, 400);
    assert.equal((await call('vote', { ...vote, kind: 'users' }, sessions.member)).status, 400);
    for (const [kind, id] of [
      ['post', 26],
      ['post', 9999],
      ['comment', 2],
      ['comment', 3],
    ])
      assert.equal((await call('vote', { kind, id, value: 1 }, sessions.member)).status, 404);
    const r = await handle(
      new Request(`${origin}/api/vote`, {
        method: 'POST',
        headers: {
          cookie: `${sessions.member}; ${CONSENT_COOKIE}=${CONSENT_VERSION}`,
          origin: 'https://other.example',
          'content-type': 'application/json',
          'x-techcare-request': '1',
        },
        body: JSON.stringify(vote),
      }),
    );
    assert.equal(r.status, 403);
  });
  await test('one vote per member is idempotent, can switch direction, and can be removed', async () => {
    const vote = { kind: 'post', id: 1, value: 1 };
    assert.deepEqual((await call('vote', vote, sessions.member)).data, { score: 1, myVote: 1 });
    assert.deepEqual((await call('vote', vote, sessions.member)).data, { score: 1, myVote: 1 });
    assert.equal(one('SELECT count(*) AS n FROM post_votes WHERE post_id=1').n, 1);
    assert.deepEqual((await call('vote', { ...vote, value: -1 }, sessions.member)).data, {
      score: -1,
      myVote: -1,
    });
    assert.deepEqual((await call('vote', vote, sessions.admin)).data, { score: 0, myVote: 1 });
    assert.equal((await call('post?id=1', null, sessions.member)).data.post.myVote, -1);
    assert.equal((await call('post?id=1')).data.post.myVote, 0);
    assert.deepEqual((await call('vote', { ...vote, value: 0 }, sessions.member)).data, {
      score: 1,
      myVote: 0,
    });
    closeDatabases();
    assert.equal((await call('post?id=1', null, sessions.admin)).data.post.myVote, 1);
    assert.equal(one('SELECT count(*) AS n FROM migrations WHERE version=5').n, 1);
  });
  await test('top sorting uses persisted scores before pagination and preserves search/category filters', async () => {
    assert.equal((await call('posts?sort=newest')).data.posts[0].id, 25);
    assert.equal((await call('posts?sort=top')).data.posts[0].id, 1);
    assert.equal((await call('posts?sort=top&q=number%2025')).data.posts[0].id, 25);
    assert.deepEqual((await call('posts?sort=top&category=Hardware')).data.posts, []);
    assert.equal((await call('posts?sort=invalid')).status, 400);
  });
  await test('comment votes persist and are never exposed for pending replies', async () => {
    assert.deepEqual(
      (await call('vote', { kind: 'comment', id: 1, value: 1 }, sessions.member)).data,
      { score: 1, myVote: 1 },
    );
    const response = await call('comments?post=1', null, sessions.member);
    assert.equal(response.data.comments.length, 1);
    assert.equal(response.data.comments[0].myVote, 1);
    assert.equal((await call('comments?post=1')).data.comments[0].myVote, 0);
    assert.deepEqual(
      (await call('vote', { kind: 'comment', id: 1, value: -1 }, sessions.member)).data,
      { score: -1, myVote: -1 },
    );
    closeDatabases();
    assert.equal((await call('comments?post=1')).data.comments[0].score, -1);
  });
  await test('member comments remain moderated while staff comments publish immediately', async () => {
    assert.equal(
      (await call('comments', { post_id: 1, body: 'A helpful member comment.' }, sessions.member))
        .status,
      201,
    );
    assert.equal((await call('post?id=1')).data.post.replies, 1);
    assert.equal(
      (await call('comments', { post_id: 1, body: 'A published staff comment.' }, sessions.admin))
        .status,
      201,
    );
    assert.equal((await call('post?id=1')).data.post.replies, 2);
    run("UPDATE posts SET status='rejected' WHERE id=1");
    assert.equal((await call('comments?post=1')).status, 404);
    assert.equal(
      (await call('vote', { kind: 'comment', id: 1, value: 0 }, sessions.member)).status,
      404,
    );
    assert.equal(
      (await call('vote', { kind: 'post', id: 1, value: 0 }, sessions.member)).status,
      404,
    );
    run('DELETE FROM comments WHERE id=1');
    assert.equal(one('SELECT count(*) AS n FROM comment_votes').n, 0);
    run('DELETE FROM posts WHERE id=1');
    assert.equal(one('SELECT count(*) AS n FROM post_votes').n, 0);
    assert.equal(one('SELECT count(*) AS n FROM pragma_foreign_key_check').n, 0);
  });
} finally {
  closeDatabases();
  const child = relative(tmpdir(), temporary);
  if (child.startsWith('techcare-discussion-') && !child.includes('..') && !isAbsolute(child))
    await rm(temporary, { recursive: true, force: true });
}
