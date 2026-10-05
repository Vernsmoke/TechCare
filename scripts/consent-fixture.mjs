import { CONSENT_COOKIE, CONSENT_VERSION } from '../shared/src/consent.mjs';

// Isolated browser tests of other features start after the agreement step.
// The agreement itself is exercised by community-updates.test.mjs and UI checks.
export function consentStorage(origin) {
  const url = new URL(origin);
  return {
    cookies: [
      {
        name: CONSENT_COOKIE,
        value: CONSENT_VERSION,
        domain: url.hostname,
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 3600,
        httpOnly: true,
        secure: url.protocol === 'https:',
        sameSite: 'Lax',
      },
    ],
    origins: [],
  };
}
