import { randomBytes, pbkdf2Sync, timingSafeEqual, createHash, createHmac } from 'node:crypto';
import { one, run, now } from '../config/db.mjs';

export class Problem extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const secret = () => randomBytes(32).toString('base64url');
const JWT_LIFETIME = 60 * 60 * 24 * 7;
const JWT_ISSUER = 'techcare';
function jwtKey() {
  const key =
    process.env.TECHCARE_JWT_SECRET ||
    (process.env.NODE_ENV === 'production'
      ? ''
      : (globalThis.__techcareDevJWTSecret ||= randomBytes(32).toString('base64url')));
  if (Buffer.byteLength(key) < 32)
    throw new Error('TECHCARE_JWT_SECRET must contain at least 32 bytes.');
  return key;
}
function jwtSignature(input) {
  return createHmac('sha256', jwtKey()).update(input).digest('base64url');
}
export function issueJWT(userId, issuedAt = now()) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: String(userId),
      iss: JWT_ISSUER,
      iat: issuedAt,
      exp: issuedAt + JWT_LIFETIME,
      jti: secret(),
    }),
  ).toString('base64url');
  const content = `${header}.${payload}`;
  return `${content}.${jwtSignature(content)}`;
}
function verifyJWT(token, time = now()) {
  try {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerPart, payloadPart, signature] = parts;
    const expected = Buffer.from(jwtSignature(`${headerPart}.${payloadPart}`));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    if (
      header.alg !== 'HS256' ||
      header.typ !== 'JWT' ||
      payload.iss !== JWT_ISSUER ||
      !/^[1-9]\d*$/.test(payload.sub) ||
      !Number.isSafeInteger(payload.iat) ||
      !Number.isSafeInteger(payload.exp) ||
      payload.iat > time + 60 ||
      payload.exp <= time ||
      payload.exp - payload.iat !== JWT_LIFETIME ||
      typeof payload.jti !== 'string' ||
      payload.jti.length < 32
    )
      return null;
    return payload;
  } catch {
    return null;
  }
}
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
  if (!token || !verifyJWT(token)) return null;
  return await one(
    'SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?',
    digest(token),
    now(),
  );
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
  const r = await one('SELECT * FROM rate_limits WHERE key=?', key);
  if (r && r.count >= limit)
    throw new Problem(
      `Too many attempts. Try again in ${Math.max(1, r.expires - time)} seconds.`,
      429,
    );
  await run(
    'INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',
    key,
    time + seconds,
  );
}
export function assertConfig() {
  if (process.env.NODE_ENV === 'production' && process.env.TECHCARE_DEV_VERIFY === '1')
    throw new Error('Classroom verification must be disabled in production.');
  if (process.env.NODE_ENV === 'production') jwtKey();
}
export function demoMode(request) {
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
  return `techcare=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${expire ? 0 : JWT_LIFETIME}${process.env.TECHCARE_SECURE_COOKIES === '1' ? '; Secure' : ''}`;
}
