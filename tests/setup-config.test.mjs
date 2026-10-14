import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateLocalSetup } from '../scripts/setup-config.mjs';
import { assertDatabaseConfig, mysqlSQL } from '../backend/src/config/db.mjs';
import { assertObjectStorageConfig } from '../backend/src/services/object-storage.mjs';
import { assertMailConfig } from '../backend/src/services/mail.mjs';

const local = {
  TECHCARE_ORIGIN: 'http://127.0.0.1:3000',
  TECHCARE_SECURE_COOKIES: '0',
  TECHCARE_DEV_VERIFY: '1',
  TECHCARE_DB_DRIVER: 'mysql',
  TECHCARE_DB_HOST: '127.0.0.1',
  TECHCARE_DB_NAME: 'techcare',
  TECHCARE_DB_USER: 'techcare_app',
  TECHCARE_DB_PASSWORD: '',
};
test('fresh local setup supports both documented loopback addresses', () => {
  assert.deepEqual(validateLocalSetup(local, '24.0.0'), []);
  assert.deepEqual(
    validateLocalSetup({ ...local, TECHCARE_ORIGIN: 'http://localhost:3000' }, '24.0.0'),
    [],
  );
});
test('local setup permits a MySQL account with no password', () => {
  assert.deepEqual(validateLocalSetup(local, '24.0.0'), []);
  assert.ok(
    validateLocalSetup({ ...local, TECHCARE_DB_DRIVER: 'sqlite' }, '24.0.0').some((error) =>
      error.includes('TECHCARE_DB_DRIVER=mysql'),
    ),
  );
});
test('application database defaults to MySQL and only isolated test processes may select SQLite', () => {
  const names = [
    'NODE_ENV',
    'TECHCARE_DB_DRIVER',
    'TECHCARE_TEST_SQLITE',
    'TECHCARE_DB_HOST',
    'TECHCARE_DB_NAME',
    'TECHCARE_DB_USER',
    'TECHCARE_DB_PASSWORD',
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.TECHCARE_DB_DRIVER;
    delete process.env.TECHCARE_TEST_SQLITE;
    for (const name of names.slice(3)) delete process.env[name];
    assert.throws(assertDatabaseConfig, /TECHCARE_DB_HOST/);
    Object.assign(process.env, {
      TECHCARE_DB_HOST: '127.0.0.1',
      TECHCARE_DB_NAME: 'techcare',
      TECHCARE_DB_USER: 'techcare_app',
      TECHCARE_DB_PASSWORD: '',
    });
    assert.doesNotThrow(assertDatabaseConfig);
    process.env.TECHCARE_DB_DRIVER = 'sqlite';
    assert.throws(assertDatabaseConfig, /isolated tests and migration utilities/);
    process.env.TECHCARE_TEST_SQLITE = '1';
    assert.doesNotThrow(assertDatabaseConfig);
  } finally {
    for (const name of names)
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
  }
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
test('production database configuration requires MySQL settings and never accepts SQLite', () => {
  const names = [
    'NODE_ENV',
    'TECHCARE_DB_DRIVER',
    'TECHCARE_DB_HOST',
    'TECHCARE_DB_PORT',
    'TECHCARE_DB_NAME',
    'TECHCARE_DB_USER',
    'TECHCARE_DB_PASSWORD',
    'TECHCARE_DB_SSL',
    'TECHCARE_DB_POOL_SIZE',
    'TECHCARE_DB_CONNECT_TIMEOUT_MS',
    'TECHCARE_TEST_SQLITE',
    'TECHCARE_ISOLATED_TEST_RUNTIME',
    'TECHCARE_ORIGIN',
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.TECHCARE_DB_DRIVER;
    for (const name of names.slice(2)) delete process.env[name];
    assert.throws(assertDatabaseConfig, /TECHCARE_DB_HOST/);
    Object.assign(process.env, {
      TECHCARE_DB_HOST: '127.0.0.1',
      TECHCARE_DB_PORT: '3306',
      TECHCARE_DB_NAME: 'techcare',
      TECHCARE_DB_USER: 'techcare',
      TECHCARE_DB_PASSWORD: '',
    });
    assert.throws(assertDatabaseConfig, /TECHCARE_DB_PASSWORD/);
    process.env.TECHCARE_DB_PASSWORD = 'local-test-only';
    assert.throws(assertDatabaseConfig, /TECHCARE_DB_SSL=1/);
    process.env.TECHCARE_DB_SSL = '1';
    assert.doesNotThrow(assertDatabaseConfig);
    process.env.TECHCARE_DB_DRIVER = 'sqlite';
    assert.throws(assertDatabaseConfig, /Production requires MySQL/);
    Object.assign(process.env, {
      TECHCARE_TEST_SQLITE: '1',
      TECHCARE_ISOLATED_TEST_RUNTIME: '1',
      TECHCARE_ORIGIN: 'https://example.test',
    });
    assert.throws(assertDatabaseConfig, /Production requires MySQL/);
    process.env.TECHCARE_ORIGIN = 'http://127.0.0.1:3002';
    assert.doesNotThrow(assertDatabaseConfig);
  } finally {
    for (const name of names)
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
  }
});
test('MySQL SQL translation preserves reserved words and upsert syntax', () => {
  assert.equal(
    mysqlSQL('INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1'),
    'INSERT INTO rate_limits VALUES(?,1,?) ON DUPLICATE KEY UPDATE count=count+1',
  );
  assert.equal(
    mysqlSQL("SELECT value FROM settings WHERE key='hero'"),
    "SELECT `value` FROM settings WHERE `key`='hero'",
  );
  assert.equal(
    mysqlSQL(
      'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    ),
    'INSERT INTO settings VALUES(?,?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)',
  );
});
test('fresh MySQL schema creates an empty content catalog', async () => {
  const schema = await readFile(new URL('../backend/schema/mysql.sql', import.meta.url), 'utf8');
  for (const table of ['resources', 'guides', 'booths', 'announcements'])
    assert.ok(schema.includes(`CREATE TABLE IF NOT EXISTS ${table} (`), `${table} table exists`);
  assert.doesNotMatch(
    schema,
    /INSERT(?:\s+IGNORE)?\s+INTO\s+(?:`)?(?:resources|guides|booths|announcements)(?:`)?/i,
  );
});
test('production requires private B2 storage and real SMTP configuration', () => {
  const names = [
    'NODE_ENV',
    'TECHCARE_B2_BUCKET',
    'TECHCARE_B2_ENDPOINT',
    'TECHCARE_B2_REGION',
    'TECHCARE_B2_KEY_ID',
    'TECHCARE_B2_APPLICATION_KEY',
    'TECHCARE_SMTP_HOST',
    'TECHCARE_SMTP_PORT',
    'TECHCARE_SMTP_FROM',
    'TECHCARE_SMTP_USER',
    'TECHCARE_SMTP_PASSWORD',
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    process.env.NODE_ENV = 'production';
    for (const name of names.slice(1)) delete process.env[name];
    assert.throws(assertObjectStorageConfig, /Backblaze B2/);
    assert.throws(assertMailConfig, /TECHCARE_SMTP_HOST/);
    Object.assign(process.env, {
      TECHCARE_B2_BUCKET: 'techcare-private',
      TECHCARE_B2_ENDPOINT: 'https://s3.us-west-004.backblazeb2.com',
      TECHCARE_B2_REGION: 'us-west-004',
      TECHCARE_B2_KEY_ID: 'local-test-key',
      TECHCARE_B2_APPLICATION_KEY: 'local-test-secret',
      TECHCARE_SMTP_HOST: 'smtp.example.test',
      TECHCARE_SMTP_FROM: 'help@example.test',
    });
    assert.doesNotThrow(assertObjectStorageConfig);
    assert.doesNotThrow(assertMailConfig);
    process.env.TECHCARE_B2_ENDPOINT = 'http://s3.us-west-004.backblazeb2.com';
    assert.throws(assertObjectStorageConfig, /HTTPS/);
    process.env.TECHCARE_SMTP_USER = 'local-test-user';
    assert.throws(assertMailConfig, /both TECHCARE_SMTP_USER/);
  } finally {
    for (const name of names)
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
  }
});
