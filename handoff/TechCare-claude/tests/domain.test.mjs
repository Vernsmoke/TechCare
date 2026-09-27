import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import sharp from 'sharp';
import nodemailer from 'nodemailer';
import { handle } from '../src/lib/server/api.mjs';
import { all, one, run, now, closeDatabases, transaction } from '../src/lib/server/db.mjs';
import { passwordHash, passwordOK, assertConfig } from '../src/lib/server/auth.mjs';
const directory = await mkdtemp(join(tmpdir(), 'techcare-test-'));
process.env.TECHCARE_DATA_DIR = directory;
process.env.TECHCARE_DEV_VERIFY = '1';
process.env.TECHCARE_ORIGIN = 'http://127.0.0.1:3000';
const origin = process.env.TECHCARE_ORIGIN;
function client() {
  return { cookie: '' };
}
async function call(c, path, data, extra = {}) {
  const headers = {
    cookie: c.cookie,
    ...(data !== undefined
      ? { 'content-type': 'application/json', origin, 'x-techcare-request': '1' }
      : {}),
    ...extra,
  };
  const r = await handle(
    new Request(`${origin}/api/${path}`, {
      method: data !== undefined ? 'POST' : 'GET',
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),
  );
  if (r.headers.get('set-cookie')) c.cookie = r.headers.get('set-cookie').split(';')[0];
  const content = r.headers.get('content-type')?.includes('json')
    ? await r.json()
    : Buffer.from(await r.arrayBuffer());
  return { status: r.status, data: content, headers: r.headers };
}
const a = client(),
  b = client(),
  c = client(),
  guest = client();
const pw = 'Synthetic-password-7391';
async function register(who, name, email) {
  const r = await call(who, 'register', { name, email, password: pw });
  assert.equal(r.status, 201);
  return r.data.development_code;
}
async function verify(who, email, code) {
  assert.equal((await call(who, 'verify', { email, code })).status, 200);
}
async function login(who, email, password = pw) {
  const r = await call(who, 'login', { email, password });
  assert.equal(r.status, 200);
  return r;
}
let aid, bid, cid, postId, avatar;
try {
  await test('TechCare API acceptance', async (t) => {
    await t.test(
      'registration is unverified, duplicate conflict is safe, verification is strict',
      async () => {
        const code = await register(a, 'Ari Test', 'ari@example.test');
        assert.match(code, /^\d{6}$/);
        assert.equal(
          (await call(a, 'login', { email: 'ari@example.test', password: pw })).status,
          403,
        );
        assert.equal(
          (await call(a, 'verify', { email: 'ari@example.test', code: `${code}extra` })).status,
          400,
        );
        await verify(a, 'ari@example.test', code);
        assert.equal((await call(a, 'verify', { email: 'ari@example.test', code })).status, 400);
        const duplicate = await call(a, 'register', {
          name: 'Duplicate',
          email: ' ARI@example.test ',
          password: pw,
        });
        assert.equal(duplicate.status, 409);
        assert.doesNotMatch(duplicate.data.error, /sqlite|UNIQUE/i);
        const session = await login(a, 'ari@example.test');
        aid = session.data.user.id;
        assert.match(session.headers.get('set-cookie'), /HttpOnly/);
        assert.match(session.headers.get('set-cookie'), /SameSite=Lax/);
        run("UPDATE users SET role='admin' WHERE id=?", aid);
      },
    );
    await t.test(
      'five invalid attempts lock a code; resend cooldown and leading zero verification work',
      async () => {
        const code = await register(b, 'Bea Test', 'bea@example.test');
        assert.equal(
          (await call(b, 'resend-verification', { email: 'bea@example.test' })).status,
          429,
        );
        for (let i = 0; i < 5; i++)
          assert.equal(
            (
              await call(b, 'verify', {
                email: 'bea@example.test',
                code: code === '999999' ? '888888' : '999999',
              })
            ).status,
            400,
          );
        assert.equal((await call(b, 'verify', { email: 'bea@example.test', code })).status, 400);
        run(
          'UPDATE email_verifications SET last_sent=last_sent-61 WHERE user_id=(SELECT id FROM users WHERE email=?)',
          'bea@example.test',
        );
        const resend = await call(b, 'resend-verification', { email: 'bea@example.test' });
        assert.equal(resend.status, 200);
        assert.equal((await call(b, 'verify', { email: 'bea@example.test', code })).status, 400);
        run(
          'UPDATE email_verifications SET code_hash=? WHERE user_id=(SELECT id FROM users WHERE email=?)',
          passwordHash('001234'),
          'bea@example.test',
        );
        await verify(b, 'bea@example.test', '001234');
        bid = (await login(b, 'bea@example.test')).data.user.id;
        const codeC = await register(c, 'Cam Test', 'cam@example.test');
        await verify(c, 'cam@example.test', codeC);
        cid = (await login(c, 'cam@example.test')).data.user.id;
      },
    );
    await t.test('expired verification is rejected', async () => {
      const temp = client(),
        code = await register(temp, 'Expired Test', 'expired@example.test');
      run(
        'UPDATE email_verifications SET expires=? WHERE user_id=(SELECT id FROM users WHERE email=?)',
        now() - 1,
        'expired@example.test',
      );
      assert.equal(
        (await call(temp, 'verify', { email: 'expired@example.test', code })).status,
        400,
      );
    });
    await t.test(
      'missing SMTP rolls back registration; proxy clients cannot use classroom codes',
      async () => {
        process.env.TECHCARE_DEV_VERIFY = '0';
        assert.equal(
          (
            await call(guest, 'register', {
              name: 'No Mail',
              email: 'nomail@example.test',
              password: pw,
            })
          ).status,
          503,
        );
        assert.equal(one('SELECT id FROM users WHERE email=?', 'nomail@example.test'), undefined);
        process.env.TECHCARE_DEV_VERIFY = '1';
        const r = await call(
          guest,
          'register',
          { name: 'Proxy Test', email: 'proxy@example.test', password: pw },
          { 'x-forwarded-for': '203.0.113.1' },
        );
        assert.equal(r.status, 503);
        assert.equal(r.data.development_code, undefined);
      },
    );
    await t.test('CSRF rejects missing/foreign origin and missing custom header', async () => {
      const data = { rating: 5, message: 'This is helpful feedback.' };
      assert.equal(
        (await call(b, 'feedback', data, { origin: 'https://evil.example' })).status,
        403,
      );
      assert.equal((await call(b, 'feedback', data, { origin: '' })).status, 403);
      assert.equal((await call(b, 'feedback', data, { 'x-techcare-request': '' })).status, 403);
    });
    await t.test(
      'SMTP delivery hides codes and delivery failure leaves no partial account',
      async () => {
        const original = nodemailer.createTransport,
          mode = process.env.TECHCARE_DEV_VERIFY;
        process.env.TECHCARE_DEV_VERIFY = '0';
        process.env.TECHCARE_SMTP_HOST = 'smtp.example.test';
        process.env.TECHCARE_SMTP_FROM = 'techcare@example.test';
        let delivered, options;
        try {
          nodemailer.createTransport = (config) => {
            options = config;
            return {
              sendMail: async (message) => {
                delivered = message;
              },
              close() {},
            };
          };
          const r = await call(guest, 'register', {
            name: 'SMTP Test',
            email: 'smtp@example.test',
            password: pw,
          });
          assert.equal(r.status, 201);
          assert.equal(r.data.development_code, undefined);
          assert.equal(options.requireTLS, true);
          assert.equal(delivered.to, 'smtp@example.test');
          const code = delivered.text.match(/code is (\d{6})/)[1];
          await verify(guest, 'smtp@example.test', code);
          nodemailer.createTransport = () => ({
            sendMail: async () => {
              throw new Error('Synthetic SMTP failure');
            },
            close() {},
          });
          assert.equal(
            (
              await call(guest, 'register', {
                name: 'Failed Mail',
                email: 'failedmail@example.test',
                password: pw,
              })
            ).status,
            503,
          );
          assert.equal(
            one('SELECT id FROM users WHERE email=?', 'failedmail@example.test'),
            undefined,
          );
        } finally {
          nodemailer.createTransport = original;
          process.env.TECHCARE_DEV_VERIFY = mode;
          delete process.env.TECHCARE_SMTP_HOST;
          delete process.env.TECHCARE_SMTP_FROM;
        }
      },
    );
    await t.test('guest and member authorization are enforced directly', async () => {
      assert.equal((await call(guest, 'dashboard')).status, 401);
      assert.equal((await call(b, 'queue')).status, 403);
      assert.equal((await call(b, 'admin/users')).status, 403);
      assert.equal((await call(b, 'resource', { title: 'No access' })).status, 403);
    });
    await t.test(
      'question submission stays pending and is visible in its own dashboard',
      async () => {
        const r = await call(b, 'posts', {
          title: 'Why is my laptop running slowly?',
          body: 'My Windows laptop is running slowly. I restarted and checked the free space.',
          category: 'Operating system',
        });
        assert.equal(r.status, 201);
        postId = r.data.id;
        assert.ok(
          (await call(b, 'dashboard')).data.posts.some(
            (p) => p.id === postId && p.status === 'pending',
          ),
        );
        assert.ok(!(await call(guest, 'posts')).data.posts.some((p) => p.id === postId));
        assert.equal((await call(guest, `comments?post=${postId}`)).status, 404);
        assert.equal(
          (await call(b, 'comments', { post_id: postId, body: 'A reply to a pending post' }))
            .status,
          404,
        );
      },
    );
    await t.test(
      'Approve & Answer validates first, publishes atomically, and rejects concurrent retries',
      async () => {
        assert.equal(
          (
            await call(a, 'moderate', {
              kind: 'post',
              id: postId,
              status: 'published',
              answer: 'x',
            })
          ).status,
          400,
        );
        assert.equal(one('SELECT status FROM posts WHERE id=?', postId).status, 'pending');
        const decisions = await Promise.all([
          call(a, 'moderate', {
            kind: 'post',
            id: postId,
            status: 'published',
            answer: 'Check the optional startup apps in Task Manager.',
          }),
          call(a, 'moderate', {
            kind: 'post',
            id: postId,
            status: 'published',
            answer: 'An answer that should not be duplicated.',
          }),
        ]);
        assert.deepEqual(decisions.map((r) => r.status).sort(), [200, 409]);
        assert.equal(one('SELECT count(*) AS n FROM comments WHERE post_id=?', postId).n, 1);
        assert.equal(one("SELECT count(*) AS n FROM audit WHERE action='approve-and-answer'").n, 1);
        assert.equal((await call(guest, `comments?post=${postId}`)).data.comments[0].role, 'admin');
      },
    );
    await t.test('transaction failure rolls back both publication and answer', async () => {
      const q = (
        await call(b, 'posts', {
          title: 'Another valid question title',
          body: 'This is a detailed problem report with enough context.',
          category: 'General',
        })
      ).data.id;
      run(
        "CREATE TRIGGER fail_answer BEFORE INSERT ON comments WHEN NEW.body='forced rollback' BEGIN SELECT RAISE(ABORT,'test failure'); END",
      );
      assert.equal(
        (
          await call(a, 'moderate', {
            kind: 'post',
            id: q,
            status: 'published',
            answer: 'forced rollback',
          })
        ).status,
        500,
      );
      assert.equal(one('SELECT status FROM posts WHERE id=?', q).status, 'pending');
      run('DROP TRIGGER fail_answer');
      assert.equal(
        (await call(a, 'moderate', { kind: 'post', id: q, status: 'rejected' })).status,
        200,
      );
      assert.equal(
        (await call(a, 'moderate', { kind: 'post', id: 999999, status: 'published' })).status,
        409,
      );
    });
    await t.test(
      'member replies need review, staff replies publish immediately, and search excludes rejected content',
      async () => {
        assert.equal(
          (
            await call(b, 'comments', {
              post_id: postId,
              body: 'I have tried clearing the startup apps.',
            })
          ).status,
          201,
        );
        assert.equal((await call(guest, `comments?post=${postId}`)).data.comments.length, 1);
        const pending = (await call(a, 'queue')).data.comments[0];
        assert.equal(
          (await call(a, 'moderate', { kind: 'comment', id: pending.id, status: 'published' }))
            .status,
          200,
        );
        assert.equal(
          (
            await call(a, 'comments', {
              post_id: postId,
              body: 'Apply official updates and test again.',
            })
          ).status,
          201,
        );
        assert.equal((await call(guest, `comments?post=${postId}`)).data.comments.length, 3);
        assert.equal((await call(guest, 'posts?q=slowly')).data.posts.length, 1);
        assert.equal((await call(guest, 'posts?q=Another%20valid')).data.posts.length, 0);
        assert.equal((await call(guest, 'posts?q=' + 'x'.repeat(81))).status, 400);
      },
    );
    await t.test('private feedback is staff only, rating and length validated', async () => {
      assert.equal(
        (await call(b, 'feedback', { rating: 5, message: 'Very helpful and clear instructions.' }))
          .status,
        201,
      );
      assert.equal(
        (await call(b, 'feedback', { rating: 6, message: 'Very helpful and clear instructions.' }))
          .status,
        400,
      );
      assert.equal((await call(a, 'queue')).data.feedback.length, 1);
      assert.equal((await call(c, 'queue')).status, 403);
    });
    await t.test(
      'Lost & Found approval strips reporter identity and rejects sensitive public descriptions',
      async () => {
        assert.equal(
          (
            await call(b, 'lost-found', {
              kind: 'found',
              item: 'Blue laptop bag',
              location: 'Library',
              details: 'Contact me on bea@example.test',
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await call(b, 'lost-found', {
              kind: 'found',
              item: 'Blue laptop bag',
              location: 'Library',
              details: 'A blue laptop bag with a small fabric ribbon.',
            })
          ).status,
          201,
        );
        assert.equal((await call(guest, 'lost-found')).data.reports.length, 0);
        const report = (await call(a, 'queue')).data.reports[0];
        await call(a, 'moderate', { kind: 'report', id: report.id, status: 'published' });
        const publicReport = (await call(guest, 'lost-found')).data.reports[0];
        for (const key of ['user_id', 'name', 'email']) assert.equal(publicReport[key], undefined);
      },
    );
    await t.test(
      'follows are independent from friendship and cannot be self-directed',
      async () => {
        assert.equal((await call(a, 'follow', { user_id: aid })).status, 400);
        assert.equal((await call(a, 'follow', { user_id: bid })).data.following, true);
        assert.equal(
          (await call(a, 'messages', { user_id: bid, body: 'Follow does not grant access' }))
            .status,
          403,
        );
        assert.equal((await call(a, 'messages?user=' + bid)).status, 403);
      },
    );
    await t.test(
      'real images decode and re-encode, malformed and oversized media fail',
      async () => {
        const buffer = await sharp({
          create: { width: 24, height: 24, channels: 3, background: '#2357b7' },
        })
          .png()
          .toBuffer();
        const pic = 'data:image/png;base64,' + buffer.toString('base64');
        const valid = await call(b, 'profile', {
          name: 'Bea Test',
          bio: 'A private introduction',
          visibility: 'private',
          picture: pic,
        });
        assert.equal(valid.status, 200);
        avatar = valid.data.user.avatar;
        const bad =
          'data:image/png;base64,' +
          Buffer.from('\x89PNG\r\n\x1a\nsmall-picture').toString('base64');
        assert.equal((await call(b, 'profile', { name: 'Bea Test', picture: bad })).status, 400);
        const huge = 'data:image/png;base64,' + Buffer.alloc(3000001).toString('base64');
        assert.equal((await call(b, 'profile', { name: 'Bea Test', picture: huge })).status, 400);
        assert.equal((await call(a, 'admin/hero', { file: pic })).status, 200);
        assert.equal((await call(guest, 'admin/logo', { file: pic })).status, 401);
        assert.equal((await call(b, 'admin/logo', { file: pic })).status, 403);
        assert.equal((await call(b, 'admin/logo', { restore: true })).status, 403);
        const savedLogo = await call(a, 'admin/logo', { file: pic });
        assert.equal(savedLogo.status, 200);
        assert.equal((await call(guest, 'settings')).data.logo, savedLogo.data.logo);
        assert.equal((await call(guest, savedLogo.data.logo.replace('/api/', ''))).status, 200);
        assert.equal((await call(a, 'admin/logo', { file: bad })).status, 400);
        assert.equal((await call(a, 'admin/logo', { file: huge })).status, 400);
        assert.equal((await call(guest, 'settings')).data.logo, savedLogo.data.logo);
        const icon = await call(guest, 'branding-icon');
        assert.equal(icon.headers.get('content-type'), 'image/png');
        assert.equal((await sharp(icon.data).metadata()).width, 64);
        assert.equal((await call(a, 'admin/logo', { restore: true })).status, 200);
        assert.equal((await call(guest, 'settings')).data.logo, '');
        assert.equal((await call(guest, 'branding-icon')).status, 200);
        assert.equal(
          (
            await call(a, 'resource', {
              title: 'Device care image',
              description: 'A test image',
              category: 'Hardware',
              type: 'image',
              file: pic,
              author: 'Synthetic fixture',
            })
          ).status,
          201,
        );
        assert.equal(
          (await call(b, avatar.replace('/api/', ''))).headers.get('content-type'),
          'image/webp',
        );
      },
    );
    await t.test(
      'question photos obey moderation, reject unsafe files, and clean up failed submissions',
      async () => {
        const bytes = await sharp({
          create: { width: 30, height: 20, channels: 3, background: '#2458bc' },
        })
          .jpeg()
          .withMetadata()
          .toBuffer();
        const photo = 'data:image/jpeg;base64,' + bytes.toString('base64');
        const question = {
          title: 'Photo of a laptop problem',
          body: 'This is a synthetic photo showing the problem with a laptop.',
          category: 'Hardware',
          photo,
        };
        assert.equal((await call(guest, 'posts', question)).status, 401);
        const count = one('SELECT count(*) AS n FROM posts').n;
        for (const invalid of [
          'data:image/svg+xml;base64,PHN2Zz4=',
          'data:image/png;base64,YmFk',
          '/api/media/reuse.webp',
          'data:image/jpeg;base64,' + Buffer.alloc(3000001).toString('base64'),
        ]) {
          assert.equal((await call(b, 'posts', { ...question, photo: invalid })).status, 400);
        }
        assert.equal(one('SELECT count(*) AS n FROM posts').n, count);
        const submitted = await call(b, 'posts', question);
        assert.equal(submitted.status, 201);
        const id = submitted.data.id;
        const saved = one('SELECT photo FROM posts WHERE id=?', id).photo;
        const route = saved.replace('/api/', '');
        assert.equal((await call(guest, route)).status, 403);
        assert.equal((await call(c, route)).status, 403);
        assert.equal((await call(a, route)).status, 200);
        assert.equal((await call(b, route)).status, 200);
        assert.equal((await call(b, 'dashboard')).data.posts.find((p) => p.id === id).photo, saved);
        assert.equal((await call(a, 'queue')).data.posts.find((p) => p.id === id).photo, saved);
        assert.ok(!(await call(guest, 'posts')).data.posts.some((p) => p.id === id));
        assert.equal(
          (await call(a, 'moderate', { kind: 'post', id, status: 'published' })).status,
          200,
        );
        const publicPhoto = await call(guest, route);
        assert.equal(publicPhoto.status, 200);
        assert.match(publicPhoto.headers.get('cache-control'), /no-store/);
        const metadata = await sharp(publicPhoto.data).metadata();
        assert.equal(metadata.format, 'webp');
        assert.equal(metadata.exif, undefined);
        assert.equal((await call(guest, 'posts')).data.posts.find((p) => p.id === id).photo, saved);
        // A saved URL must re-check current visibility rather than cache publication.
        run("UPDATE posts SET status='rejected' WHERE id=?", id);
        assert.equal((await call(guest, route)).status, 403);
        assert.equal((await call(b, route)).status, 200);
        const pending = (await call(b, 'posts', question)).data.id;
        const pendingRoute = one('SELECT photo FROM posts WHERE id=?', pending).photo.replace(
          '/api/',
          '',
        );
        assert.equal(
          (await call(a, 'moderate', { kind: 'post', id: pending, status: 'rejected' })).status,
          200,
        );
        assert.equal((await call(guest, pendingRoute)).status, 403);
        const mediaBefore = one('SELECT count(*) AS n FROM media').n;
        run(
          "CREATE TRIGGER fail_photo_post BEFORE INSERT ON posts WHEN NEW.title='Photo of a laptop problem' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END",
        );
        try {
          assert.equal((await call(b, 'posts', question)).status, 500);
        } finally {
          run('DROP TRIGGER fail_photo_post');
        }
        assert.equal(one('SELECT count(*) AS n FROM media').n, mediaBefore);
      },
    );
    await t.test(
      'private fields and saved media URLs are protected from strangers and followers',
      async () => {
        const visible = (await call(guest, 'members')).data.members.find((u) => u.id === bid);
        assert.equal(visible.avatar, '');
        assert.equal(visible.bio, '');
        assert.equal(visible.email, undefined);
        assert.equal(
          (await call(a, 'dashboard')).data.following.find((u) => u.id === bid).avatar,
          '',
        );
        assert.equal((await call(a, avatar.replace('/api/', ''))).status, 403);
        assert.equal((await call(guest, avatar.replace('/api/', ''))).status, 403);
        assert.equal((await call(b, avatar.replace('/api/', ''))).status, 200);
      },
    );
    await t.test(
      'inverse friendship requests produce one pair; acceptance grants limited access',
      async () => {
        const requests = await Promise.all([
          call(a, 'friend', { user_id: bid, action: 'request' }),
          call(b, 'friend', { user_id: aid, action: 'request' }),
        ]);
        assert.deepEqual(requests.map((r) => r.status).sort(), [200, 409]);
        const pair = one('SELECT * FROM friendships');
        assert.equal(all('SELECT * FROM friendships').length, 1);
        const recipient = pair.receiver === bid ? b : a,
          target = pair.sender;
        assert.equal(
          (await call(recipient, 'friend', { user_id: target, action: 'accept' })).status,
          200,
        );
        assert.equal((await call(a, avatar.replace('/api/', ''))).status, 200);
        assert.equal(
          (await call(a, 'members')).data.members.find((u) => u.id === bid).bio,
          'A private introduction',
        );
        assert.equal(
          (await call(guest, `comments?post=${postId}`)).data.comments.find(
            (r) => r.name === 'Bea Test',
          ).avatar,
          '',
        );
      },
    );
    await t.test(
      'only accepted participants can message; reporting shares one message only',
      async () => {
        const message = await call(b, 'messages', { user_id: aid, body: 'A private test message' });
        assert.equal(message.status, 201);
        assert.equal((await call(a, 'messages?user=' + bid)).data.messages.length, 1);
        assert.equal((await call(c, 'messages?user=' + bid)).status, 403);
        assert.equal(
          (
            await call(c, 'message-report', {
              message_id: message.data.id,
              reason: 'A third party trying to access evidence',
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await call(a, 'message-report', {
              message_id: message.data.id,
              reason: 'A test report submitted by the recipient',
            })
          ).status,
          201,
        );
        assert.equal(
          (await call(a, 'queue')).data.messageReports[0].body,
          'A private test message',
        );
      },
    );
    await t.test(
      'unfriending and blocking revoke both conversation and media reads immediately',
      async () => {
        await call(a, 'friend', { user_id: bid, action: 'remove' });
        assert.equal((await call(a, 'messages?user=' + bid)).status, 403);
        assert.equal(
          (await call(b, 'messages', { user_id: aid, body: 'Cannot send now' })).status,
          403,
        );
        assert.equal((await call(a, avatar.replace('/api/', ''))).status, 403);
        await call(a, 'friend', { user_id: bid, action: 'request' });
        await call(b, 'friend', { user_id: aid, action: 'accept' });
        assert.equal((await call(a, 'messages?user=' + bid)).data.messages.length, 1);
        await call(b, 'block', { user_id: aid, action: 'block' });
        assert.equal((await call(a, 'messages?user=' + bid)).status, 403);
        assert.equal((await call(a, 'friend', { user_id: bid, action: 'request' })).status, 403);
        assert.equal((await call(a, avatar.replace('/api/', ''))).status, 403);
        await call(b, 'block', { user_id: aid, action: 'unblock' });
        assert.equal((await call(a, 'messages?user=' + bid)).status, 403);
      },
    );
    await t.test(
      'admin continuity is protected; role demotions apply to existing sessions',
      async () => {
        assert.equal((await call(a, 'admin/role', { id: aid, role: 'member' })).status, 403);
        assert.equal((await call(b, 'admin/role', { id: cid, role: 'moderator' })).status, 403);
        assert.equal((await call(a, 'admin/role', { id: cid, role: 'moderator' })).status, 200);
        assert.equal((await call(c, 'queue')).status, 200);
        assert.equal((await call(a, 'admin/role', { id: cid, role: 'member' })).status, 200);
        assert.equal((await call(c, 'queue')).status, 403);
        run("UPDATE users SET role='admin' WHERE id=?", cid);
        assert.equal((await call(a, 'admin/role', { id: cid, role: 'member' })).status, 403);
        run("UPDATE users SET role='member' WHERE id=?", cid);
      },
    );
    await t.test(
      'resource links require HTTPS and video uploads fail closed without validator',
      async () => {
        for (const url of [
          'http://example.test/video',
          'https://user:pass@example.test/video',
          'javascript:alert(1)',
        ])
          assert.equal(
            (
              await call(a, 'resource', {
                title: 'Invalid link',
                description: '',
                category: 'General',
                type: 'external',
                url,
                author: 'Test',
              })
            ).status,
            400,
          );
        assert.equal(
          (
            await call(a, 'resource', {
              title: 'Safe resource',
              description: '',
              category: 'General',
              type: 'external',
              url: 'https://example.test/guide',
              author: 'Test',
            })
          ).status,
          201,
        );
        assert.equal(
          (
            await call(a, 'resource', {
              title: 'Video fixture',
              description: '',
              category: 'General',
              type: 'video',
              file: 'data:video/mp4;base64,AAAA',
              author: 'Test',
            })
          ).status,
          503,
        );
      },
    );
    await t.test(
      'server validates overlong values without truncation and rejects malformed bodies',
      async () => {
        assert.equal(
          (
            await call(b, 'posts', {
              title: 'x'.repeat(121),
              body: 'This is a long enough question body.',
              category: 'General',
            })
          ).status,
          400,
        );
        assert.equal((await call(b, 'profile', { name: 'x'.repeat(81) })).status, 400);
        const r = await handle(
          new Request(origin + '/api/posts', {
            method: 'POST',
            headers: { origin, 'content-type': 'application/json', 'x-techcare-request': '1' },
            body: 'not json',
          }),
        );
        assert.equal(r.status, 400);
        const huge = await handle(
          new Request(origin + '/api/login', {
            method: 'POST',
            headers: { origin, 'content-type': 'application/json', 'x-techcare-request': '1' },
            body: 'x'.repeat(32769),
          }),
        );
        assert.equal(huge.status, 413);
      },
    );
    await t.test(
      'password recovery uses one-time tokens and revokes existing sessions',
      async () => {
        const known = await call(c, 'forgot-password', { email: 'cam@example.test' }),
          unknown = await call(guest, 'forgot-password', { email: 'unknown@example.test' });
        assert.equal(known.data.message, unknown.data.message);
        assert.ok(known.data.development_token);
        const newPassword = 'New-synthetic-password-824';
        assert.equal(
          (
            await call(guest, 'reset-password', {
              token: known.data.development_token,
              password: newPassword,
            })
          ).status,
          200,
        );
        assert.equal((await call(c, 'dashboard')).status, 401);
        assert.equal(
          (
            await call(guest, 'reset-password', {
              token: known.data.development_token,
              password: newPassword,
            })
          ).status,
          400,
        );
        await login(c, 'cam@example.test', newPassword);
        const r = await call(c, 'forgot-password', { email: 'cam@example.test' });
        run('UPDATE password_resets SET expires=?', now() - 1);
        assert.equal(
          (await call(guest, 'reset-password', { token: r.data.development_token, password: pw }))
            .status,
          400,
        );
      },
    );
    await t.test(
      'login abuse limits return retry feedback; logout and session expiry revoke access',
      async () => {
        for (let i = 0; i < 10; i++)
          await call(guest, 'login', { email: 'nobody@example.test', password: pw });
        const limited = await call(guest, 'login', { email: 'nobody@example.test', password: pw });
        assert.equal(limited.status, 429);
        assert.ok(limited.headers.get('retry-after'));
        await call(b, 'logout', {});
        assert.equal((await call(b, 'dashboard')).status, 401);
        await login(b, 'bea@example.test');
        run('UPDATE sessions SET expires=? WHERE user_id=?', now() - 1, bid);
        assert.equal((await call(b, 'dashboard')).status, 401);
      },
    );
    await t.test('published content paginates without exposing pending records', async () => {
      transaction(() => {
        for (let i = 0; i < 24; i++)
          run(
            "INSERT INTO posts(user_id,title,body,category,status,created) VALUES(?,?,?,'General','published',?)",
            aid,
            `Pagination question ${i}`,
            'A synthetic published question body.',
            now() + i,
          );
      });
      const first = (await call(guest, 'posts')).data,
        second = (await call(guest, 'posts?page=2')).data;
      assert.equal(first.posts.length, 20);
      assert.equal(first.hasMore, true);
      assert.equal(second.posts.length, 5);
      assert.ok(!first.posts.some((p) => second.posts.some((q) => q.id === p.id)));
    });
    await t.test(
      'production refuses classroom verification and password hashes preserve baseline compatibility',
      () => {
        const previous = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        assert.throws(assertConfig, /disabled in production/);
        process.env.NODE_ENV = previous || 'test';
        assert.equal(passwordOK(pw, passwordHash(pw)), true);
        assert.equal(passwordOK('wrong', passwordHash(pw)), false);
      },
    );
  });
} finally {
  closeDatabases();
  const relativePath = relative(resolve(tmpdir()), resolve(directory));
  if (
    relativePath.startsWith('techcare-test-') &&
    !relativePath.includes('..') &&
    !isAbsolute(relativePath)
  )
    await rm(directory, { recursive: true, force: true });
}
