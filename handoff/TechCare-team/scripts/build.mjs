import { spawn } from 'node:child_process';
// Separate build output avoids Windows file locks while the preview is running.
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
  env: { ...process.env, TECHCARE_BUILD_DIR: '.next-production' },
  stdio: 'inherit',
  windowsHide: true,
});
child.on('exit', (code) => process.exit(code || 0));
