import { consentStorage } from './consent-fixture.mjs';
import { spawn } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, relative, join, isAbsolute } from 'node:path';
const temporary = await mkdtemp(join(tmpdir(), 'techcare-production-'));
const origin = 'http://127.0.0.1:3002';
// Local build verification only: no HTTPS edge, no public bind, no real accounts.
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', 'frontend', '--hostname', '127.0.0.1', '--port', '3002'],
  {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      TECHCARE_DEV_VERIFY: '0',
      TECHCARE_ORIGIN: origin,
      TECHCARE_DATA_DIR: temporary,
      TECHCARE_BUILD_DIR: '.next-production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  },
);
let browser;
let serverLog = '';
server.stdout.on('data', (chunk) => (serverLog += chunk));
server.stderr.on('data', (chunk) => (serverLog += chunk));
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(origin + '/api/settings', { signal: AbortSignal.timeout(5000) })).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
    if (i === 59 || server.exitCode !== null)
      throw new Error(`Production test server did not start.\n${serverLog}`);
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
  const branding = await fetch(origin + '/api/branding-icon');
  expect(branding.status).toBe(200);
  expect(branding.headers.get('content-type')).toContain('image/');
  expect((await fetch(origin + '/static/techcare-hero.webp')).status).toBe(200);
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    storageState: consentStorage(origin),
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
  await expect(page.getByRole('heading', { name: 'Before you join in' })).toBeVisible();
  await page.locator('#consent-terms').check();
  await page.locator('#consent-privacy').check();
  await page.getByRole('button', { name: 'Accept and continue' }).click();
  await expect(page.getByRole('link', { name: 'Create Account', exact: true })).toBeVisible();
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Before you join in' })).toBeVisible();
  await page.locator('#consent-terms').check();
  await page.locator('#consent-privacy').check();
  await page.getByRole('button', { name: 'Accept and continue' }).click();
  await page.getByRole('link', { name: 'Create Account', exact: true }).click();
  await expect(page).toHaveURL(origin + '/register');
  await expect(page.getByRole('heading', { name: 'Join the TechCare community' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.demo-note')).toHaveCount(0);
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
    consentOnLoadAndReload: true,
    brandingAndPublicAssets: true,
  };
  await mkdir('artifacts', { recursive: true });
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
