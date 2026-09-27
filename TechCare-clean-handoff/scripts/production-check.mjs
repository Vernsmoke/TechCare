import { spawn } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, relative, join, isAbsolute } from 'node:path';
const temporary = await mkdtemp(join(tmpdir(), 'techcare-production-'));
const origin = 'http://127.0.0.1:3002';
// Local build verification only: no HTTPS edge, no public bind, no real accounts.
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3002'],
  {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      TECHCARE_DEV_VERIFY: '0',
      TECHCARE_ORIGIN: origin,
      TECHCARE_DATA_DIR: temporary,
      TECHCARE_BUILD_DIR: '.next-production',
    },
    stdio: 'ignore',
    windowsHide: true,
  },
);
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(origin + '/api/settings')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
    if (i === 59) throw new Error('Production test server did not start.');
  }
  const response = await fetch(origin),
    second = await fetch(origin),
    policy = response.headers.get('content-security-policy');
  expect(response.status).toBe(200);
  expect(policy).toContain("'strict-dynamic'");
  expect(policy).not.toContain('unsafe-eval');
  expect(policy.split(';').find((s) => s.includes('script-src'))).not.toContain('unsafe-inline');
  expect(policy).not.toBe(second.headers.get('content-security-policy'));
  expect(response.headers.get('x-frame-options')).toBe('DENY');
  expect((await fetch(origin + '/media/legacy-avatar.png')).status).toBe(404);
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (m) => {
    if (
      m.type() === 'error' &&
      /Content Security Policy|Refused to execute|Hydration/.test(m.text())
    )
      errors.push(m.text());
  });
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.demo-note')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Troubleshooting Guides', exact: true }).click();
  await page.getByRole('button', { name: /Speed up a slow Windows PC/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(errors).toEqual([]);
  const report = {
    compiledBuild: true,
    htmlCsp: 'fresh nonces, strict-dynamic, no unsafe-inline scripts or production eval',
    antiFraming: 'DENY',
    legacyMediaStatus: 404,
    classroomDisabled: true,
    browserErrors: errors,
  };
  await writeFile('artifacts/production-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server.kill();
  if (server.exitCode === null) await new Promise((r) => server.once('exit', r));
  const path = relative(resolve(tmpdir()), resolve(temporary));
  if (path.startsWith('techcare-production-') && !path.includes('..') && !isAbsolute(path))
    await rm(temporary, { recursive: true, force: true });
}
