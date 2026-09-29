import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/app/api/handlers.mjs';

const envKeys = [
  'TECHCARE_GOOGLE_CLIENT_ID',
  'TECHCARE_GOOGLE_CLIENT_SECRET',
  'TECHCARE_GOOGLE_REDIRECT_URI',
  'TECHCARE_ORIGIN',
  'TECHCARE_SECURE_COOKIES',
];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function request(path, headers = {}) {
  return handle(new Request(`http://127.0.0.1:3000/api/${path}`, { headers }));
}

test('Google OAuth start and callback protect state and PKCE', async () => {
  try {
    delete process.env.TECHCARE_GOOGLE_CLIENT_ID;
    delete process.env.TECHCARE_GOOGLE_CLIENT_SECRET;
    delete process.env.TECHCARE_GOOGLE_REDIRECT_URI;
    const disabled = await request('auth/google');
    assert.equal(
      new URL(disabled.headers.get('location')).searchParams.get('google'),
      'not-configured',
    );

    process.env.TECHCARE_GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.TECHCARE_GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.TECHCARE_GOOGLE_REDIRECT_URI = 'http://localhost:5000/api/auth/google/callback';
    process.env.TECHCARE_ORIGIN = 'http://localhost:5000';
    process.env.TECHCARE_SECURE_COOKIES = '0';

    const start = await handle(new Request('http://localhost:5000/api/auth/google'));
    assert.equal(start.status, 302);
    const authorization = new URL(start.headers.get('location'));
    assert.equal(authorization.origin, 'https://accounts.google.com');
    assert.equal(authorization.searchParams.get('client_id'), 'test-client-id');
    assert.equal(authorization.searchParams.get('nonce')?.length, 43);
    assert.equal(authorization.searchParams.get('state')?.length, 43);
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(authorization.searchParams.get('code_challenge'));
    const startCookies = start.headers.get('set-cookie');
    assert.match(startCookies, /techcare_google_state=/);
    assert.match(startCookies, /techcare_google_nonce=/);
    assert.match(startCookies, /techcare_google_verifier=/);
    assert.match(startCookies, /HttpOnly/);
    assert.match(startCookies, /SameSite=Lax/);

    const callback = await handle(
      new Request(
        'http://localhost:5000/api/auth/google/callback?state=attacker-state&code=attacker-code',
        {
          headers: {
            cookie:
              'techcare_google_state=expected-state; techcare_google_nonce=expected-nonce; techcare_google_verifier=expected-verifier',
          },
        },
      ),
    );
    assert.equal(callback.status, 302);
    assert.equal(new URL(callback.headers.get('location')).searchParams.get('google'), 'failed');
    assert.match(callback.headers.get('set-cookie'), /Max-Age=0/);
  } finally {
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
});
