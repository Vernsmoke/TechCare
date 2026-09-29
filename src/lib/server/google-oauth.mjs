import { randomBytes, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

const cookieNames = ['techcare_google_state', 'techcare_google_nonce', 'techcare_google_verifier'];
const cookieAge = 600;

export class GoogleOAuthRejected extends Error {}

function config() {
  const clientId = process.env.TECHCARE_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.TECHCARE_GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.TECHCARE_GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;

  const redirect = new URL(redirectUri);
  if (
    (redirect.protocol !== 'https:' &&
      !(redirect.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(redirect.hostname))) ||
    redirect.username ||
    redirect.password ||
    redirect.search ||
    redirect.hash
  )
    throw new Error('Google OAuth redirect URI must be HTTPS, except for localhost development.');

  return { clientId, clientSecret, redirectUri, secure: redirect.protocol === 'https:' };
}

export function googleOAuthConfigured() {
  return Boolean(
    process.env.TECHCARE_GOOGLE_CLIENT_ID &&
    process.env.TECHCARE_GOOGLE_CLIENT_SECRET &&
    process.env.TECHCARE_GOOGLE_REDIRECT_URI,
  );
}

function oauthClient(settings) {
  return new OAuth2Client(settings.clientId, settings.clientSecret, settings.redirectUri);
}

function cookie(name, value, maxAge, secure) {
  return `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

function secureCookie() {
  return (
    process.env.TECHCARE_SECURE_COOKIES === '1' ||
    process.env.TECHCARE_GOOGLE_REDIRECT_URI?.startsWith('https://') === true
  );
}

function cookieValue(request, name) {
  const entry = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return entry?.slice(name.length + 1) || '';
}

export function clearGoogleOAuthCookies() {
  const secure = secureCookie();
  return cookieNames.map((name) => cookie(name, '', 0, secure));
}

export async function startGoogleOAuth() {
  const settings = config();
  if (!settings) throw new Error('Google OAuth is not configured.');

  const client = oauthClient(settings);
  const verifier = await client.generateCodeVerifierAsync();
  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const url = client.generateAuthUrl({
    access_type: 'online',
    code_challenge: verifier.codeChallenge,
    code_challenge_method: 'S256',
    include_granted_scopes: true,
    nonce,
    prompt: 'select_account',
    scope: ['openid', 'email', 'profile'],
    state,
  });
  const response = new Response(null, {
    status: 302,
    headers: { Location: url, 'Cache-Control': 'no-store' },
  });
  response.headers.append('Set-Cookie', cookie(cookieNames[0], state, cookieAge, settings.secure));
  response.headers.append('Set-Cookie', cookie(cookieNames[1], nonce, cookieAge, settings.secure));
  response.headers.append(
    'Set-Cookie',
    cookie(cookieNames[2], verifier.codeVerifier, cookieAge, settings.secure),
  );
  return response;
}

function sameSecret(actual, expected) {
  if (!actual || !expected) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export async function completeGoogleOAuth(request) {
  const settings = config();
  if (!settings) throw new Error('Google OAuth is not configured.');

  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  const expectedState = cookieValue(request, cookieNames[0]);
  const nonce = cookieValue(request, cookieNames[1]);
  const codeVerifier = cookieValue(request, cookieNames[2]);
  if (
    url.searchParams.has('error') ||
    !sameSecret(state, expectedState) ||
    !nonce ||
    !codeVerifier ||
    !code ||
    code.length > 2048
  )
    throw new GoogleOAuthRejected('Google OAuth response could not be verified.');

  const client = oauthClient(settings);
  const { tokens } = await client.getToken({ code, codeVerifier });
  if (!tokens.id_token) throw new Error('Google OAuth did not return an identity token.');
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: settings.clientId,
  });
  const payload = ticket.getPayload();
  if (
    !payload ||
    !sameSecret(payload.nonce || '', nonce) ||
    typeof payload.sub !== 'string' ||
    !payload.sub ||
    payload.sub.length > 255 ||
    typeof payload.email !== 'string' ||
    payload.email_verified !== true
  )
    throw new GoogleOAuthRejected('Google identity is missing verified account details.');

  return {
    subject: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name:
      typeof payload.name === 'string' && payload.name.trim()
        ? payload.name.trim().slice(0, 80)
        : payload.email.split('@')[0].slice(0, 80),
  };
}
