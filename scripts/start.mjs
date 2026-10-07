import nextEnv from '@next/env';
import { spawn } from 'node:child_process';
import { assertObjectStorageConfig } from '../backend/src/services/object-storage.mjs';
import { assertDatabaseReady } from '../backend/src/config/db.mjs';
import { assertConfig } from '../backend/src/middleware/auth.mjs';
import { assertMailConfig } from '../backend/src/services/mail.mjs';
nextEnv.loadEnvConfig(process.cwd());
process.env.NODE_ENV = 'production';
assertConfig();
let origin;
try {
  origin = new URL(process.env.TECHCARE_ORIGIN);
} catch {
  throw new Error('Production requires an exact approved HTTPS origin and secure cookies.');
}
if (
  origin.protocol !== 'https:' ||
  origin.origin !== process.env.TECHCARE_ORIGIN ||
  origin.username ||
  origin.password ||
  process.env.TECHCARE_SECURE_COOKIES !== '1'
)
  throw new Error('Production requires an approved HTTPS origin and secure cookies.');
await assertDatabaseReady();
assertObjectStorageConfig();
assertMailConfig();
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', 'frontend', '--hostname', '127.0.0.1'],
  {
    env: { ...process.env, TECHCARE_BUILD_DIR: '.next-production' },
    stdio: 'inherit',
    windowsHide: true,
  },
);
child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code) => process.exit(code ?? 1));
