export function validateLocalSetup(env, nodeVersion) {
  const errors = [];
  if (Number(nodeVersion.split('.')[0]) < 24) errors.push('Install Node.js 24 or later.');
  let origin;
  try {
    origin = new URL(env.TECHCARE_ORIGIN);
    if (origin.origin !== env.TECHCARE_ORIGIN || origin.username || origin.password)
      throw new Error('Not an origin');
  } catch {
    errors.push(
      'Set TECHCARE_ORIGIN to an exact origin without a trailing slash or path, such as http://127.0.0.1:3000.',
    );
  }
  if (
    origin &&
    (origin.protocol !== 'http:' ||
      !['127.0.0.1', 'localhost'].includes(origin.hostname) ||
      origin.port !== '3000')
  ) {
    errors.push(
      'npm run dev serves this computer on port 3000. Set TECHCARE_ORIGIN=http://127.0.0.1:3000 (or http://localhost:3000). Use the deployment instructions for shared hosting.',
    );
  }
  if (env.TECHCARE_SECURE_COOKIES === '1') {
    errors.push(
      'Local HTTP preview needs TECHCARE_SECURE_COOKIES=0. Keep secure cookies enabled for HTTPS production.',
    );
  }
  if (env.TECHCARE_DEV_VERIFY !== '1' && (!env.TECHCARE_SMTP_HOST || !env.TECHCARE_SMTP_FROM)) {
    errors.push(
      'Set TECHCARE_DEV_VERIFY=1 for local classroom verification, or configure SMTP host and sender for verification emails.',
    );
  }
  return errors;
}
