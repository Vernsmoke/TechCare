import { randomInt } from 'node:crypto';
import { all, one, run, now, transaction } from './db.mjs';
import {
  Problem,
  currentUser,
  requireUser,
  ownUser,
  member,
  relationship,
  blocked,
  friendAccess,
  digest,
  secret,
  passwordHash,
  passwordOK,
  throttle,
  cookie,
  demoMode,
  assertConfig,
} from './auth.mjs';
import * as v from './validation.mjs';
import { sendMail } from './mail.mjs';
import { readMedia, saveMedia, discardQuestionMedia } from './media.mjs';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const json = (payload, status = 200, headers = {}) =>
  Response.json(payload, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const staff = ['moderator', 'admin'];
const audit = (user, action, kind, target, reason = '') =>
  run(
    'INSERT INTO audit(actor,action,kind,target,reason,created) VALUES(?,?,?,?,?,?)',
    user.id,
    action,
    kind,
    target,
    reason,
    now(),
  );
const publicAvatar = "CASE WHEN u.visibility='private' THEN '' ELSE u.avatar END AS avatar";
function targetUser(value, me) {
  const target = v.id(value);
  if (target === me.id || !one('SELECT id FROM users WHERE id=?', target))
    throw new Problem('Choose another member.');
  return target;
}
function paginated(rows, key, page) {
  return { [key]: rows.slice(0, 20), page: page.number, hasMore: rows.length > 20 };
}
async function body(request, maximum = 32768) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new Problem('Use JSON for this request.', 415);
  if (Number(request.headers.get('content-length') || 0) > maximum)
    throw new Problem('Request exceeds the upload limit.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new Problem('Request body is required.');
  const chunks = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > maximum) {
      await reader.cancel();
      throw new Problem('Request exceeds the upload limit.', 413);
    }
    chunks.push(value);
  }
  try {
    const d = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw 0;
    return d;
  } catch {
    throw new Problem('The request contains invalid JSON.');
  }
}
function mutationGuard(request) {
  const expected = process.env.TECHCARE_ORIGIN || new URL(request.url).origin;
  if (
    request.headers.get('origin') !== expected ||
    request.headers.get('x-techcare-request') !== '1' ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new Problem('The request could not be verified. Refresh the page and try again.', 403);
}

export async function handle(request) {
  try {
    assertConfig();
    const url = new URL(request.url),
      path = url.pathname.replace(/^\/api\/?/, '');
    const me = currentUser(request);
    if (request.method === 'GET') return await get(path, url, me, request);
    if (request.method !== 'POST') throw new Problem('Method not allowed.', 405);
    mutationGuard(request);
    // Single-node pilot: untrusted forwarded addresses are never used as identities.
    // A global source ceiling complements persistent per-account limits.
    throttle('source:mutations', 600, 60);
    const d = await body(
      request,
      ['profile', 'resource', 'admin/hero'].includes(path)
        ? 28000000
        : ['admin/logo', 'posts'].includes(path)
          ? 4100000
          : 32768,
    );
    return await post(path, d, me, request);
  } catch (error) {
    if (error instanceof Problem)
      return json(
        { error: error.message },
        error.status,
        error.status === 429 ? { 'Retry-After': '60' } : {},
      );
    if (
      String(error?.code || '').includes('CONSTRAINT') ||
      /UNIQUE constraint/.test(error?.message || '')
    )
      return json(
        { error: 'This record already exists or has changed. Refresh and try again.' },
        409,
      );
    console.error('TechCare request failed:', error?.name || 'Error', error?.code || 'internal');
    return json({ error: 'The action could not be completed. Please try again.' }, 500);
  }
}

async function get(path, url, me, request) {
  if (path === 'me') return json({ user: ownUser(me) });
  if (path === 'settings')
    return json({
      hero:
        one("SELECT value FROM settings WHERE key='hero'")?.value || '/static/techcare-hero.webp',
      classroom: demoMode(request),
      logo: one("SELECT value FROM settings WHERE key='logo'")?.value || '',
    });
  if (path === 'branding-icon') {
    const logo = one("SELECT value FROM settings WHERE key='logo'")?.value;
    let buffer = await readFile(join(process.cwd(), 'public', 'static', 'techcare-icon.png'));
    if (logo) {
      try {
        const asset = await readMedia(logo.replace('/api/media/', ''), null);
        buffer = await sharp(asset.buffer)
          .resize(64, 64, { fit: 'contain', background: '#ffffff00' })
          .png()
          .toBuffer();
      } catch {
        /* Keep the default icon if the saved asset is unavailable. */
      }
    }
    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  if (path.startsWith('media/')) {
    const asset = await readMedia(path.slice(6), me);
    return new Response(asset.buffer, {
      headers: {
        'Content-Type': asset.mime,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    });
  }
  const page = v.page(url);
  if (path === 'dashboard') {
    requireUser(me);
    const following = all(
      'SELECT u.* FROM users u JOIN follows f ON u.id=f.followed WHERE f.follower=? ORDER BY u.name',
      me.id,
    ).map((u) => member(u, me));
    const followers = all(
      'SELECT u.* FROM users u JOIN follows f ON u.id=f.follower WHERE f.followed=? ORDER BY u.name',
      me.id,
    ).map((u) => member(u, me));
    return json({
      ...paginated(
        all(
          'SELECT id,title,status,category,created,photo FROM posts WHERE user_id=? ORDER BY created DESC,id DESC LIMIT 21 OFFSET ?',
          me.id,
          page.offset,
        ),
        'posts',
        page,
      ),
      following,
      followers,
    });
  }
  if (path === 'members') {
    const q = v.text(url.searchParams.get('q') || '', 'Search', 0, 80);
    return json(
      paginated(
        all(
          'SELECT * FROM users WHERE verified=1 AND name LIKE ? ORDER BY name,id LIMIT 21 OFFSET ?',
          `%${q}%`,
          page.offset,
        ).map((u) => member(u, me)),
        'members',
        page,
      ),
    );
  }
  if (path === 'posts') {
    const q = v.text(url.searchParams.get('q') || '', 'Search', 0, 80),
      category = url.searchParams.get('category') || '';
    if (category) v.choice(category, v.categories, 'category');
    const rows = all(
      `SELECT p.*,u.name,u.role,${publicAvatar},(SELECT count(*) FROM comments c WHERE c.post_id=p.id AND c.status='published') AS replies FROM posts p JOIN users u ON p.user_id=u.id WHERE p.status='published' AND (p.title LIKE ? OR p.body LIKE ? OR p.category LIKE ?) AND (?='' OR p.category=?) ORDER BY p.created DESC,p.id DESC LIMIT 21 OFFSET ?`,
      ...Array(3).fill(`%${q}%`),
      category,
      category,
      page.offset,
    );
    return json(paginated(rows, 'posts', page));
  }
  if (path === 'comments') {
    const post = v.id(url.searchParams.get('post'));
    if (!one("SELECT id FROM posts WHERE id=? AND status='published'", post))
      throw new Problem('Published discussion not found.', 404);
    return json(
      paginated(
        all(
          `SELECT c.id,c.body,c.created,u.name,u.role,${publicAvatar} FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? AND c.status='published' ORDER BY c.created,c.id LIMIT 21 OFFSET ?`,
          post,
          page.offset,
        ),
        'comments',
        page,
      ),
    );
  }
  if (path === 'messages/access') {
    friendAccess(me, v.id(url.searchParams.get('user')));
    return json({ allowed: true });
  }
  if (path === 'messages') {
    const other = v.id(url.searchParams.get('user'));
    friendAccess(me, other);
    const before = url.searchParams.get('before')
      ? v.id(url.searchParams.get('before'))
      : Number.MAX_SAFE_INTEGER;
    const rows = all(
      'SELECT id,sender,receiver,body,created FROM messages WHERE ((sender=? AND receiver=?) OR (sender=? AND receiver=?)) AND id<? ORDER BY id DESC LIMIT 101',
      me.id,
      other,
      other,
      me.id,
      before,
    );
    return json({ messages: rows.slice(0, 100).reverse(), hasMore: rows.length > 100 });
  }
  if (path === 'resources')
    return json(
      paginated(
        all('SELECT * FROM resources ORDER BY created DESC,id DESC LIMIT 21 OFFSET ?', page.offset),
        'resources',
        page,
      ),
    );
  if (path === 'lost-found')
    return json(
      paginated(
        all(
          "SELECT id,kind,item,details,location,created FROM lost_found WHERE status='published' ORDER BY created DESC,id DESC LIMIT 21 OFFSET ?",
          page.offset,
        ),
        'reports',
        page,
      ),
    );
  if (path === 'queue') {
    requireUser(me, staff);
    return json({
      posts: all(
        "SELECT p.*,u.name FROM posts p JOIN users u ON u.id=p.user_id WHERE p.status='pending' ORDER BY p.created,p.id",
      ),
      comments: all(
        "SELECT c.*,u.name,p.title FROM comments c JOIN users u ON u.id=c.user_id JOIN posts p ON p.id=c.post_id WHERE c.status='pending' AND p.status='published' ORDER BY c.created,c.id",
      ),
      reports: all(
        "SELECT l.*,u.name FROM lost_found l JOIN users u ON u.id=l.user_id WHERE l.status='pending' ORDER BY l.created,l.id",
      ),
      feedback: all(
        'SELECT f.*,u.name FROM feedback f JOIN users u ON u.id=f.user_id ORDER BY f.created DESC LIMIT 100',
      ),
      messageReports: all(
        'SELECT r.id,r.reason,r.created,r.reporter,m.body,m.sender,m.receiver,u.name FROM message_reports r JOIN messages m ON m.id=r.message_id JOIN users u ON u.id=r.reporter ORDER BY r.created DESC LIMIT 100',
      ),
    });
  }
  if (path === 'admin/users') {
    requireUser(me, ['admin']);
    return json({ users: all('SELECT id,name,email,role,verified FROM users ORDER BY id') });
  }
  throw new Problem('Endpoint not found.', 404);
}

async function post(path, d, me, request) {
  const time = now(),
    demo = demoMode(request);
  if (
    [
      'register',
      'login',
      'verify',
      'resend-verification',
      'forgot-password',
      'reset-password',
    ].includes(path)
  ) {
    throttle('source:auth', 60, 60);
    const address =
      typeof d.email === 'string' ? d.email.trim().toLowerCase() : String(d.token || '');
    throttle(
      `auth:${path}:${digest(address)}`,
      path === 'login' ? 10 : path === 'verify' ? 12 : 5,
      300,
    );
  }
  if (path === 'register') {
    const name = v.text(d.name, 'Display name', 2, 80),
      email = v.email(d.email),
      password = v.password(d.password);
    if (one('SELECT id FROM users WHERE email=?', email))
      throw new Problem(
        'Registration cannot be completed with these details. Try signing in or recovering your account.',
        409,
      );
    const code = String(randomInt(1000000)).padStart(6, '0');
    await sendMail(
      email,
      'Verify your TechCare account',
      `Your TechCare verification code is ${code}. It expires in 15 minutes. If you did not register, ignore this email.`,
      demo,
    );
    const hash = passwordHash(password),
      codeHash = passwordHash(code);
    transaction(() => {
      const result = run(
        'INSERT INTO users(name,email,hash,created) VALUES(?,?,?,?)',
        name,
        email,
        hash,
        time,
      );
      run(
        'INSERT INTO email_verifications(user_id,code_hash,expires,last_sent) VALUES(?,?,?,?)',
        result.lastInsertRowid,
        codeHash,
        time + 900,
        time,
      );
    });
    return json(
      {
        ok: true,
        message: 'Enter the six-digit code sent to your email.',
        ...(demo ? { development_code: code } : {}),
      },
      201,
    );
  }
  if (path === 'verify') {
    const email = v.email(d.email);
    if (typeof d.code !== 'string' || !/^\d{6}$/.test(d.code))
      throw new Problem('Enter exactly six digits.');
    const r = one(
      'SELECT u.id,u.verified,e.* FROM users u LEFT JOIN email_verifications e ON u.id=e.user_id WHERE u.email=?',
      email,
    );
    if (!r || r.verified || !r.code_hash || r.expires <= time || r.attempts >= 5)
      throw new Problem('Invalid or expired verification code. Request a new code.');
    if (!passwordOK(d.code, r.code_hash)) {
      run('UPDATE email_verifications SET attempts=attempts+1 WHERE user_id=?', r.id);
      throw new Problem('Invalid or expired verification code.');
    }
    transaction(() => {
      run('UPDATE users SET verified=1 WHERE id=?', r.id);
      run('DELETE FROM email_verifications WHERE user_id=?', r.id);
    });
    return json({ ok: true, message: 'Email verified. You can now sign in.' });
  }
  if (path === 'resend-verification') {
    const email = v.email(d.email),
      r = one(
        'SELECT u.id,e.last_sent FROM users u JOIN email_verifications e ON e.user_id=u.id WHERE u.email=? AND u.verified=0',
        email,
      );
    if (r && time - r.last_sent < 60)
      throw new Problem('Please wait 60 seconds between verification emails.', 429);
    let code;
    if (r) {
      code = String(randomInt(1000000)).padStart(6, '0');
      await sendMail(
        email,
        'Your new TechCare verification code',
        `Your code is ${code}. It expires in 15 minutes.`,
        demo,
      );
      run(
        'UPDATE email_verifications SET code_hash=?,expires=?,attempts=0,last_sent=? WHERE user_id=?',
        passwordHash(code),
        time + 900,
        time,
        r.id,
      );
    }
    return json({
      ok: true,
      message: 'If this account is awaiting verification, a new code has been sent.',
      ...(demo && code ? { development_code: code } : {}),
    });
  }
  if (path === 'login') {
    const email = v.email(d.email),
      password = v.password(d.password),
      u = one('SELECT * FROM users WHERE email=?', email);
    // Equal-cost check when the account is absent.
    if (
      !passwordOK(password, u?.hash || `pbkdf2_sha256$600000$${'00'.repeat(16)}$${'00'.repeat(32)}`)
    )
      throw new Problem('Invalid email or password.', 401);
    if (!u.verified) throw new Problem('Verify your email before signing in.', 403);
    const token = secret();
    run('DELETE FROM sessions WHERE expires<=?', time);
    run('INSERT INTO sessions VALUES(?,?,?)', digest(token), u.id, time + 604800);
    return json({ user: ownUser(u) }, 200, { 'Set-Cookie': cookie(token) });
  }
  if (path === 'logout') {
    const token = request.headers.get('cookie')?.match(/(?:^|;\s*)techcare=([^;]+)/)?.[1];
    if (token) run('DELETE FROM sessions WHERE token_hash=?', digest(token));
    return json({ ok: true }, 200, { 'Set-Cookie': cookie('', true) });
  }
  if (path === 'forgot-password') {
    const email = v.email(d.email),
      u = one('SELECT id FROM users WHERE email=?', email);
    let token;
    if (u) {
      token = secret();
      try {
        await sendMail(
          email,
          'Reset your TechCare password',
          `Open TechCare, choose Sign In, then Reset password with a token. Your single-use reset token is ${token}. It expires in 15 minutes. If you did not request this, ignore this email.`,
          demo,
        );
        transaction(() => {
          run('DELETE FROM password_resets WHERE user_id=? OR expires<=?', u.id, time);
          run('INSERT INTO password_resets VALUES(?,?,?)', digest(token), u.id, time + 900);
        });
      } catch {
        token = undefined;
        console.error('TechCare recovery delivery unavailable. Check SMTP configuration.');
      }
    }
    return json({
      message: 'If this account exists, password recovery instructions have been sent.',
      ...(demo && token ? { development_token: token } : {}),
    });
  }
  if (path === 'reset-password') {
    const token = v.text(d.token, 'Reset token', 20, 100),
      password = v.password(d.password),
      r = one(
        'SELECT * FROM password_resets WHERE token_hash=? AND expires>?',
        digest(token),
        time,
      );
    if (!r) throw new Problem('This recovery token is invalid or expired. Request a new one.');
    const hash = passwordHash(password);
    transaction(() => {
      run('UPDATE users SET hash=? WHERE id=?', hash, r.user_id);
      run('DELETE FROM password_resets WHERE user_id=?', r.user_id);
      run('DELETE FROM sessions WHERE user_id=?', r.user_id);
    });
    return json({ message: 'Password updated. Sign in with your new password.' }, 200, {
      'Set-Cookie': cookie('', true),
    });
  }
  requireUser(me);
  throttle(`member:${me.id}:${path}`, path === 'messages' ? 30 : 20, 60);
  if (path === 'profile') {
    const name = v.text(d.name, 'Display name', 2, 80),
      bio = v.text(d.bio || '', 'Bio', 0, 400),
      visibility = v.choice(
        d.visibility || me.visibility,
        ['public', 'private'],
        'profile visibility',
      );
    const avatar = d.picture ? await saveMedia(d.picture, me.id, 'profile') : me.avatar;
    run(
      'UPDATE users SET name=?,bio=?,visibility=?,avatar=? WHERE id=?',
      name,
      bio,
      visibility,
      avatar,
      me.id,
    );
    return json({ user: ownUser(one('SELECT * FROM users WHERE id=?', me.id)) });
  }
  if (path === 'follow') {
    const target = targetUser(d.user_id, me);
    if (blocked(me.id, target)) throw new Problem('This connection is unavailable.', 403);
    const found = one('SELECT 1 FROM follows WHERE follower=? AND followed=?', me.id, target);
    if (found) run('DELETE FROM follows WHERE follower=? AND followed=?', me.id, target);
    else run('INSERT INTO follows VALUES(?,?)', me.id, target);
    return json({ following: !found });
  }
  if (path === 'friend') {
    const target = targetUser(d.user_id, me),
      action = v.choice(d.action, ['request', 'accept', 'remove'], 'friendship action');
    if (blocked(me.id, target)) throw new Problem('This connection is unavailable.', 403);
    transaction(() => {
      const state = relationship(me.id, target);
      if (action === 'request' && state === 'none')
        run('INSERT INTO friendships(sender,receiver,created) VALUES(?,?,?)', me.id, target, time);
      else if (action === 'accept' && state === 'incoming')
        run(
          "UPDATE friendships SET status='accepted' WHERE sender=? AND receiver=? AND status='pending'",
          target,
          me.id,
        );
      else if (action === 'remove' && state !== 'none')
        run(
          'DELETE FROM friendships WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?)',
          me.id,
          target,
          target,
          me.id,
        );
      else
        throw new Problem(
          'This friend request has changed. Refresh to see its current status.',
          409,
        );
    });
    return json({ ok: true });
  }
  if (path === 'block') {
    const target = targetUser(d.user_id, me);
    transaction(() => {
      if (d.action === 'unblock')
        run('DELETE FROM blocks WHERE blocker=? AND blocked=?', me.id, target);
      else if (d.action === 'block') {
        run('INSERT OR IGNORE INTO blocks VALUES(?,?,?)', me.id, target, time);
        run(
          'DELETE FROM friendships WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?)',
          me.id,
          target,
          target,
          me.id,
        );
        run(
          'DELETE FROM follows WHERE (follower=? AND followed=?) OR (follower=? AND followed=?)',
          me.id,
          target,
          target,
          me.id,
        );
      } else throw new Problem('Invalid block action.');
    });
    return json({ ok: true });
  }
  if (path === 'messages') {
    const target = targetUser(d.user_id, me),
      body = v.text(d.body, 'Message', 1, 1000);
    friendAccess(me, target);
    const r = run(
      'INSERT INTO messages(sender,receiver,body,created) VALUES(?,?,?,?)',
      me.id,
      target,
      body,
      time,
    );
    return json({ ok: true, id: Number(r.lastInsertRowid) }, 201);
  }
  if (path === 'message-report') {
    const message = v.id(d.message_id),
      reason = v.text(d.reason, 'Report reason', 10, 500),
      r = one(
        'SELECT * FROM messages WHERE id=? AND (sender=? OR receiver=?)',
        message,
        me.id,
        me.id,
      );
    if (!r) throw new Problem('Message not found.', 404);
    run(
      'INSERT INTO message_reports(reporter,message_id,reason,created) VALUES(?,?,?,?)',
      me.id,
      message,
      reason,
      time,
    );
    return json(
      { message: 'Report received. Staff can review this message and your reason only.' },
      201,
    );
  }
  if (path === 'posts') {
    const title = v.text(d.title, 'Question title', 8, 120),
      body = v.text(d.body, 'Problem description', 20, 2000),
      category = v.choice(d.category, v.categories, 'category');
    const photo = d.photo ? await saveMedia(d.photo, me.id, 'question') : '';
    let r;
    try {
      r = run(
        'INSERT INTO posts(user_id,title,body,category,created,photo) VALUES(?,?,?,?,?,?)',
        me.id,
        title,
        body,
        category,
        time,
        photo,
      );
    } catch (error) {
      if (photo) await discardQuestionMedia(photo, me.id);
      throw error;
    }
    return json(
      {
        ok: true,
        id: Number(r.lastInsertRowid),
        message: 'Question submitted for moderator review. Track its status in My Dashboard.',
      },
      201,
    );
  }
  if (path === 'comments') {
    const post = v.id(d.post_id),
      body = v.text(d.body, 'Reply', 3, 1000);
    if (!one("SELECT id FROM posts WHERE id=? AND status='published'", post))
      throw new Problem('Reply to a published discussion.', 404);
    const status = staff.includes(me.role) ? 'published' : 'pending';
    run(
      'INSERT INTO comments(post_id,user_id,body,status,created) VALUES(?,?,?,?,?)',
      post,
      me.id,
      body,
      status,
      time,
    );
    return json(
      {
        ok: true,
        message:
          status === 'published' ? 'Reply published.' : 'Reply submitted for moderator review.',
      },
      201,
    );
  }
  if (path === 'feedback') {
    const rating = v.id(d.rating);
    if (rating > 5) throw new Problem('Choose a rating from 1 to 5.');
    run(
      'INSERT INTO feedback(user_id,rating,message,created) VALUES(?,?,?,?)',
      me.id,
      rating,
      v.text(d.message, 'Feedback', 10, 1000),
      time,
    );
    return json(
      { message: 'Thank you. Your feedback has been shared privately with the project team.' },
      201,
    );
  }
  if (path === 'lost-found') {
    run(
      'INSERT INTO lost_found(user_id,kind,item,details,location,created) VALUES(?,?,?,?,?,?)',
      me.id,
      v.choice(d.kind, ['lost', 'found'], 'report type'),
      v.text(d.item, 'Item name', 3, 100),
      v.publicDescription(d.details),
      v.text(d.location, 'Location', 3, 100),
      time,
    );
    return json(
      { message: 'Your report has been submitted for review. Only approved notices are public.' },
      201,
    );
  }
  if (path === 'moderate') {
    requireUser(me, staff);
    const kind = v.choice(d.kind, ['post', 'comment', 'report'], 'content type'),
      table = { post: 'posts', comment: 'comments', report: 'lost_found' }[kind],
      target = v.id(d.id),
      status = v.choice(d.status, ['published', 'rejected'], 'decision');
    const answer = d.answer ? v.text(d.answer, 'Answer', 3, 1000) : '',
      reason = v.text(d.reason || '', 'Internal reason', 0, 500);
    if (answer && (kind !== 'post' || status !== 'published'))
      throw new Problem('An answer requires approving a question.');
    transaction(() => {
      if (
        kind === 'comment' &&
        !one(
          "SELECT c.id FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.id=? AND p.status='published'",
          target,
        )
      )
        throw new Problem('The parent discussion is unavailable.', 409);
      const r = run(`UPDATE ${table} SET status=? WHERE id=? AND status='pending'`, status, target);
      if (r.changes !== 1)
        throw new Problem(
          'This submission has already been reviewed or no longer exists. Refresh the queue.',
          409,
        );
      if (answer)
        run(
          "INSERT INTO comments(post_id,user_id,body,status,created) VALUES(?,?,?,'published',?)",
          target,
          me.id,
          answer,
          time,
        );
      audit(me, answer ? 'approve-and-answer' : status, kind, target, reason);
    });
    return json({
      message: answer
        ? 'Question and answer published together.'
        : status === 'published'
          ? 'Submission approved.'
          : 'Submission rejected.',
    });
  }
  if (path === 'resource') {
    requireUser(me, staff);
    const title = v.text(d.title, 'Title', 4, 120),
      description = v.text(d.description || '', 'Description', 0, 500),
      category = v.choice(d.category, v.categories, 'category'),
      type = v.choice(d.type, ['external', 'image', 'video'], 'resource type'),
      author = v.text(d.author, 'Source credit', 2, 80);
    const url =
      type === 'external'
        ? v.httpsURL(d.url)
        : await saveMedia(d.file, me.id, 'public', type === 'video');
    const r = run(
      'INSERT INTO resources(title,description,category,type,url,author,created) VALUES(?,?,?,?,?,?,?)',
      title,
      description,
      category,
      type,
      url,
      author,
      time,
    );
    audit(me, 'publish', 'resource', Number(r.lastInsertRowid));
    return json({ message: 'Resource published.' }, 201);
  }
  if (path === 'admin/role') {
    requireUser(me, ['admin']);
    const target = v.id(d.id),
      role = v.choice(d.role, ['member', 'moderator'], 'role');
    transaction(() => {
      const u = one('SELECT * FROM users WHERE id=?', target);
      if (!u) throw new Problem('Account not found.', 404);
      if (target === me.id || u.role === 'admin')
        throw new Problem(
          'Administrator accounts are protected. Use the approved operator procedure.',
          403,
        );
      if (!u.verified) throw new Problem('The member must verify their email first.');
      run('UPDATE users SET role=? WHERE id=?', role, target);
      audit(me, `role:${role}`, 'user', target);
    });
    return json({ message: 'Account role updated.' });
  }
  if (path === 'admin/logo') {
    requireUser(me, ['admin']);
    const logo = d.restore === true ? '' : await saveMedia(d.file, me.id, 'public', false, true);
    transaction(() => {
      run(
        "INSERT INTO settings VALUES('logo',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        logo,
      );
      audit(me, logo ? 'replace-logo' : 'restore-logo', 'settings', 0);
    });
    return json({ logo, message: logo ? 'App logo updated.' : 'Original TechCare logo restored.' });
  }
  if (path === 'admin/hero') {
    requireUser(me, ['admin']);
    const url = await saveMedia(d.file, me.id, 'public');
    transaction(() => {
      run(
        "INSERT INTO settings VALUES('hero',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        url,
      );
      audit(me, 'replace-hero', 'settings', 0);
    });
    return json({ hero: url, message: 'Homepage illustration updated.' });
  }
  throw new Problem('Endpoint not found.', 404);
}
