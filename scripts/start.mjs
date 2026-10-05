import nextEnv from '@next/env';
import { spawn } from 'node:child_process';
nextEnv.loadEnvConfig(process.cwd());
if (process.env.TECHCARE_DEV_VERIFY === '1')
  throw new Error('Production startup refused: disable TECHCARE_DEV_VERIFY.');
if (
  !process.env.TECHCARE_ORIGIN?.startsWith('https://') ||
  process.env.TECHCARE_SECURE_COOKIES !== '1'
)
  throw new Error('Production requires an approved HTTPS origin and secure cookies.');
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
