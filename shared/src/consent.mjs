// Bump this value when either agreement changes to request acceptance again.
export const CONSENT_VERSION = '2026-10-03';
export const CONSENT_COOKIE = 'techcare-consent';
export function hasConsent(request) {
  return (
    request.headers
      .get('cookie')
      ?.split(';')
      .some((part) => part.trim() === `${CONSENT_COOKIE}=${CONSENT_VERSION}`) || false
  );
}
