import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handle } from '../backend/src/controllers/api.mjs';
import { run, now, closeDatabases } from '../backend/src/config/db.mjs';
import { CONSENT_COOKIE, CONSENT_VERSION } from '../shared/src/consent.mjs';
import { digest } from '../backend/src/middleware/auth.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'techcare-community-updates-'));
process.env.TECHCARE_DATA_DIR = temporary;
process.env.TECHCARE_DEV_VERIFY = '0';
const origin = (process.env.TECHCARE_ORIGIN = 'http://127.0.0.1:3025');
const accepted = `${CONSENT_COOKIE}=${CONSENT_VERSION}`;
async function call(path, data, cookie = '', headers = {}) {
  const response = await handle(
    new Request(`${origin}/api/${path}`, {
      method: data === undefined ? 'GET' : 'POST',
      headers: {
        cookie,
        origin,
        'content-type': 'application/json',
        'x-techcare-request': '1',
        ...headers,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
  );
  return { response, status: response.status, data: await response.json() };
}
try {
  await test('acceptance requires both current agreements, guards APIs, and preserves CSRF checks', async () => {
    assert.equal((await call('consent')).data.accepted, false);
    assert.equal((await call('posts')).data.code, 'CONSENT_REQUIRED');
    assert.equal((await call('posts', { title: 'Blocked question' })).status, 403);
    assert.equal((await call('posts', undefined, `${CONSENT_COOKIE}=old`)).status, 403);
    for (const invalid of [
      { terms: true, privacy: false, version: CONSENT_VERSION },
      { terms: false, privacy: true, version: CONSENT_VERSION },
      { terms: 'true', privacy: 'true', version: CONSENT_VERSION },
      { terms: true, privacy: true, version: 'old' },
    ])
      assert.equal((await call('consent', invalid)).status, 400);
    const payload = { terms: true, privacy: true, version: CONSENT_VERSION };
    assert.equal(
      (await call('consent', payload, '', { origin: 'https://other.test' })).status,
      403,
    );
    const result = await call('consent', payload);
    assert.equal(result.status, 200);
    const cookie = result.response.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly; SameSite=Lax/);
    assert.doesNotMatch(cookie, /Max-Age|Expires=/i);
    assert.equal((await call('consent', undefined, cookie.split(';')[0])).data.accepted, true);
    assert.equal((await call('posts', undefined, accepted)).status, 200);
    assert.equal((await call('admin/users', undefined, accepted)).status, 401);
  });

  const time = now();
  for (const [id, name, role] of [
    [1, 'Admin Tester', 'admin'],
    [2, 'Moderator Tester', 'moderator'],
    [3, 'Member Tester', 'member'],
  ]) {
    run(
      'INSERT INTO users(id,name,email,hash,role,verified,created) VALUES(?,?,?,?,?,1,?)',
      id,
      name,
      `tester${id}@example.test`,
      'unused',
      role,
      time,
    );
    run(
      'INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)',
      digest(`session${id}`),
      id,
      time + 3600000,
    );
  }
  const admin = `${accepted}; techcare=session1`;
  await test('moderator directory defaults to staff and searches members on the server with pagination', async () => {
    assert.equal(
      (await call('admin/users', undefined, `${accepted}; techcare=session3`)).status,
      403,
    );
    const staff = await call('admin/users', undefined, admin);
    assert.deepEqual(
      staff.data.users.map((user) => user.role),
      ['admin', 'moderator'],
    );
    assert.equal(
      (await call('admin/users?q=tester3%40example.test', undefined, admin)).data.users[0].id,
      3,
    );
    assert.equal((await call('admin/users?q=%25', undefined, admin)).data.users.length, 0);
    assert.equal((await call('admin/users?q=%20%20', undefined, admin)).data.users.length, 2);
    for (let i = 4; i < 28; i++)
      run(
        'INSERT INTO users(id,name,email,hash,role,verified,created) VALUES(?,?,?,?,?,1,?)',
        i,
        `Find member ${i}`,
        `find${i}@example.test`,
        'unused',
        'member',
        time,
      );
    const first = (await call('admin/users?q=Find', undefined, admin)).data;
    const second = (await call('admin/users?q=Find&page=2', undefined, admin)).data;
    assert.equal(first.users.length, 20);
    assert.equal(first.hasMore, true);
    assert.equal(second.users.length, 4);
    assert.equal(second.hasMore, false);
    assert.equal(new Set([...first.users, ...second.users].map((user) => user.id)).size, 24);
    assert.equal((await call('admin/role', { id: 3, role: 'moderator' }, admin)).status, 200);
    assert.equal((await call('admin/users', undefined, admin)).data.users.length, 3);
    assert.equal((await call('admin/role', { id: 3, role: 'member' }, admin)).status, 200);
    assert.equal((await call('admin/users', undefined, admin)).data.users.length, 2);
  });
  await test('landing feed activity includes only visible published comments', async () => {
    run(
      "INSERT INTO posts(id,user_id,title,body,category,status,created) VALUES(1,3,'A published question','A helpful question body','General','published',?)",
      time,
    );
    run(
      "INSERT INTO posts(id,user_id,title,body,category,status,created) VALUES(2,3,'A pending question','A helpful question body','General','pending',?)",
      time,
    );
    run(
      "INSERT INTO comments(post_id,user_id,body,status,created) VALUES(1,2,'Published response','published',?)",
      time + 1000,
    );
    run(
      "INSERT INTO comments(post_id,user_id,body,status,created) VALUES(1,3,'Pending response','pending',?)",
      time + 2000,
    );
    const feed = (await call('posts', undefined, accepted)).data.posts;
    assert.equal(feed.length, 1);
    assert.equal(feed[0].lastActivity, time + 1000);
    assert.equal(feed[0].replies, 1);
  });
} finally {
  closeDatabases();
  await rm(temporary, { recursive: true, force: true });
}
