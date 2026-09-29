// Authentication and shared access rules used by the API/domain modules.
// Store only token digests in MySQL so a database leak cannot replay sessions.
import { randomBytes, pbkdf2Sync, timingSafeEqual, createHash } from 'node:crypto';
import { one, run, now } from './db.mjs';

export class Problem extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const secret = () => randomBytes(32).toString('base64url');
export function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return `pbkdf2_sha256$600000$${salt}$${pbkdf2Sync(password, Buffer.from(salt, 'hex'), 600000, 32, 'sha256').toString('hex')}`;
}
export function passwordOK(password, encoded) {
  try {
    const [scheme, rounds, salt, hash] = encoded.split('$');
    if (
      scheme !== 'pbkdf2_sha256' ||
      !Number.isInteger(+rounds) ||
      +rounds < 1 ||
      +rounds > 2000000
    )
      return false;
    const a = pbkdf2Sync(password, Buffer.from(salt, 'hex'), +rounds, 32, 'sha256'),
      b = Buffer.from(hash, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
export async function currentUser(request) {
  const token = request.headers.get('cookie')?.match(/(?:^|;\s*)techcare=([^;]+)/)?.[1];
  return token
    ? one(
        'SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?',
        digest(token),
        now(),
      )
    : null;
}
export function requireUser(user, roles) {
  if (!user) throw new Problem('Please sign in to continue.', 401);
  if (roles && !roles.includes(user.role))
    throw new Problem('Your account does not have access to this action.', 403);
  return user;
}
export function ownUser(u) {
  if (!u) return null;
  const { id, name, email, role, bio, avatar, visibility } = u;
  return { id, name, email, role, bio, avatar, visibility };
}
export async function blocked(a, b) {
  return !!(await one(
    'SELECT 1 FROM blocks WHERE (blocker=? AND blocked=?) OR (blocker=? AND blocked=?)',
    a,
    b,
    b,
    a,
  ));
}
export async function relationship(a, b) {
  if (!a || a === b || (await blocked(a, b))) return 'none';
  const r = await one(
    'SELECT * FROM friendships WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?)',
    a,
    b,
    b,
    a,
  );
  return !r
    ? 'none'
    : r.status === 'accepted'
      ? 'friends'
      : r.sender === a
        ? 'outgoing'
        : 'incoming';
}
export async function member(u, viewer) {
  const friendship = await relationship(viewer?.id, u.id);
  const visible =
    viewer?.id === u.id ||
    (!(await blocked(viewer?.id || 0, u.id)) &&
      (u.visibility === 'public' || friendship === 'friends'));
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    visibility: u.visibility,
    bio: visible ? u.bio : '',
    avatar: visible ? u.avatar : '',
    friendship,
    following: !!(
      viewer &&
      (await one('SELECT 1 FROM follows WHERE follower=? AND followed=?', viewer.id, u.id))
    ),
    blocked: !!(
      viewer && (await one('SELECT 1 FROM blocks WHERE blocker=? AND blocked=?', viewer.id, u.id))
    ),
  };
}
export async function friendAccess(user, target) {
  requireUser(user);
  if ((await relationship(user.id, target)) !== 'friends')
    throw new Problem(
      'Messages require a current mutual friendship. This conversation is unavailable.',
      403,
    );
}
export async function throttle(key, limit, seconds) {
  const time = now();
  await run('DELETE FROM rate_limits WHERE expires<=?', time);
  const r = await one('SELECT * FROM rate_limits WHERE `key`=?', key);
  if (r && r.count >= limit)
    throw new Problem(
      `Too many attempts. Try again in ${Math.max(1, r.expires - time)} seconds.`,
      429,
    );
  await run(
    'INSERT INTO rate_limits(`key`,count,expires) VALUES(?,1,?) ON DUPLICATE KEY UPDATE count=count+1',
    key,
    time + seconds,
  );
}
export function assertConfig() {
  if (process.env.NODE_ENV === 'production' && process.env.TECHCARE_DEV_VERIFY === '1')
    throw new Error('Classroom verification must be disabled in production.');
}
export function demoMode(request) {
  // Development codes are deliberately restricted to direct local requests;
  // production must use real email verification instead.
  assertConfig();
  return (
    process.env.TECHCARE_DEV_VERIFY === '1' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname) &&
    (!request.headers.has('x-forwarded-for') ||
      ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.headers.get('x-forwarded-for'))) &&
    !request.headers.has('forwarded')
  );
}
export function cookie(token, expire = false) {
  // CHANGE FOR YOUR DEPLOYMENT: serve HTTPS and set TECHCARE_SECURE_COOKIES=1.
  return `techcare=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${expire ? 0 : 604800}${process.env.TECHCARE_SECURE_COOKIES === '1' ? '; Secure' : ''}`;
}
