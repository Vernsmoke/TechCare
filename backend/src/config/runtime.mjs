import { CONSENT_COOKIE, CONSENT_VERSION } from '../../../shared/src/consent.mjs';

const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function isIsolatedTestRuntime() {
  if (process.env.TECHCARE_ISOLATED_TEST_RUNTIME !== '1') return false;
  try {
    const origin = new URL(process.env.TECHCARE_ORIGIN);
    return origin.protocol === 'http:' && loopbackHosts.has(origin.hostname);
  } catch {
    return false;
  }
}

export function mayBypassConsentForBrowserTest(cookieStore) {
  return (
    process.env.TECHCARE_TEST_BYPASS_CONSENT === '1' &&
    isIsolatedTestRuntime() &&
    cookieStore.get(CONSENT_COOKIE)?.value === CONSENT_VERSION
  );
}
