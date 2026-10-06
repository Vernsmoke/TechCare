import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLocalSetup } from '../scripts/setup-config.mjs';

const local = {
  TECHCARE_ORIGIN: 'http://127.0.0.1:3000',
  TECHCARE_SECURE_COOKIES: '0',
  TECHCARE_DEV_VERIFY: '1',
};
test('fresh local setup supports both documented loopback addresses', () => {
  assert.deepEqual(validateLocalSetup(local, '24.0.0'), []);
  assert.deepEqual(
    validateLocalSetup({ ...local, TECHCARE_ORIGIN: 'http://localhost:3000' }, '24.0.0'),
    [],
  );
});
test('rejects origin settings that fail local consent or address a different server', () => {
  for (const origin of [
    '',
    'invalid',
    'http://127.0.0.1:3000/',
    'http://127.0.0.1:3000/home',
    'http://127.0.0.1:3001',
    'https://example.test',
    'http://user:pass@127.0.0.1:3000',
  ])
    assert.ok(validateLocalSetup({ ...local, TECHCARE_ORIGIN: origin }, '24.0.0').length, origin);
});
test('detects runtime, cookie and verification setup failures', () => {
  assert.ok(validateLocalSetup(local, '22.0.0').length);
  assert.ok(validateLocalSetup({ ...local, TECHCARE_SECURE_COOKIES: '1' }, '24.0.0').length);
  assert.ok(validateLocalSetup({ ...local, TECHCARE_DEV_VERIFY: '0' }, '24.0.0').length);
  assert.deepEqual(
    validateLocalSetup(
      {
        ...local,
        TECHCARE_DEV_VERIFY: '0',
        TECHCARE_SMTP_HOST: 'smtp.example.test',
        TECHCARE_SMTP_FROM: 'help@example.test',
      },
      '24.0.0',
    ),
    [],
  );
});
