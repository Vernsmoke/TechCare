// Run against a production build, using synthetic data only.
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute, resolve } from 'node:path';
import { digest, secret } from '../backend/src/middleware/auth.mjs';
import { run, now, closeDatabases } from '../backend/src/config/db.mjs';

const baseline = process.argv.includes('--baseline');
const temporary = await mkdtemp(join(tmpdir(), 'techcare-optimization-'));
process.env.TECHCARE_DATA_DIR = temporary;
const adminToken = secret();
const admin = run(
  "INSERT INTO users(name,email,hash,role,verified,created) VALUES(?,?,?,'admin',1,?)",
  'Optimization QA',
  'optimization@example.test',
  'unused',
  now(),
);
run(
  'INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)',
  digest(adminToken),
  Number(admin.lastInsertRowid),
  now() + 3600,
);
closeDatabases();
const origin = 'http://127.0.0.1:3024';
const server = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'start',
    'frontend',
    '--hostname',
    '127.0.0.1',
    '--port',
    '3024',
  ],
  {
    env: {
      ...process.env,
      TECHCARE_DATA_DIR: temporary,
      TECHCARE_ORIGIN: origin,
      TECHCARE_DEV_VERIFY: '0',
      TECHCARE_SECURE_COOKIES: '0',
      TECHCARE_BUILD_DIR: '.next-production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  },
);
let serverLog = '',
  browser;
server.stdout.on('data', (chunk) => (serverLog += chunk));
server.stderr.on('data', (chunk) => (serverLog += chunk));
const errors = [];
const accept = async (page) => {
  await page.locator('#consent-terms').check();
  await page.locator('#consent-privacy').check();
  await page.getByRole('button', { name: 'Accept and continue' }).click();
  await expect(page.getByRole('button', { name: 'Open guide assistant' })).toBeVisible();
  await page.waitForLoadState('networkidle');
};
try {
  for (let attempt = 0; ; attempt++) {
    if (server.exitCode !== null) throw new Error(serverLog);
    try {
      if ((await fetch(origin + '/api/settings', { signal: AbortSignal.timeout(2000) })).ok) break;
    } catch {}
    if (attempt === 59) throw new Error(serverLog || 'Server did not start');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const measurements = {};
  for (const path of ['/', '/guides']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const requests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/guides') requests.push(request.url());
    });
    await page.goto(origin + path, { waitUntil: 'networkidle' });
    await accept(page);
    const payload = await page.evaluate(() => {
      const scripts = performance
        .getEntriesByType('resource')
        .filter(
          (entry) => entry.name.includes('/_next/') && new URL(entry.name).pathname.endsWith('.js'),
        );
      return {
        scriptRequests: scripts.length,
        javascriptDecodedBytes: scripts.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
      };
    });
    measurements[path] = { ...payload, guideRequestsWhileAssistantClosed: requests.length };
    if (!baseline) expect(requests.length).toBe(1);
    await page.getByRole('button', { name: 'Open guide assistant' }).click();
    await expect(page.getByRole('dialog', { name: 'TechCare assistant' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    measurements[path].guideRequestsAfterOpeningAssistant = requests.length;
    if (!baseline) expect(requests.length).toBe(2);
    await page
      .getByRole('dialog', { name: 'TechCare assistant' })
      .getByRole('button', { name: 'Close guide assistant' })
      .click();
    await page.getByRole('button', { name: 'Open guide assistant' }).click();
    await page.waitForLoadState('networkidle');
    if (!baseline) expect(requests.length).toBe(2);
    await page
      .getByRole('dialog', { name: 'TechCare assistant' })
      .getByRole('button', { name: 'Close guide assistant' })
      .click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(350); // Let the existing navigation resize transition finish.
    measurements[path].mobileOverflowPixels = await page.evaluate(() =>
      Math.max(0, document.documentElement.scrollWidth - innerWidth),
    );
    if (!baseline) expect(measurements[path].mobileOverflowPixels).toBe(0);
    await context.close();
  }
  const adminContext = await browser.newContext();
  await adminContext.addCookies([
    { name: 'techcare', value: adminToken, url: origin, httpOnly: true, sameSite: 'Lax' },
  ]);
  const adminPage = await adminContext.newPage();
  adminPage.on('pageerror', (error) => errors.push(error.message));
  await adminPage.goto(origin + '/admin', { waitUntil: 'networkidle' });
  await accept(adminPage);
  await expect(adminPage.getByRole('heading', { name: 'Page content', exact: true })).toBeVisible();
  await adminPage.getByRole('button', { name: 'App settings', exact: true }).click();
  for (const name of ['App logo', 'Announcements', 'Moderator accounts'])
    await expect(adminPage.getByRole('heading', { name, exact: true })).toBeVisible();
  await adminContext.close();
  expect(errors).toEqual([]);
  const report = { mode: baseline ? 'baseline' : 'optimized', measurements, browserErrors: errors };
  await mkdir('artifacts', { recursive: true });
  await writeFile(`artifacts/optimization-${report.mode}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    const stopped = new Promise((resolve) => server.once('exit', resolve));
    server.kill();
    await stopped;
  }
  const child = relative(resolve(tmpdir()), resolve(temporary));
  if (child.startsWith('techcare-optimization-') && !child.includes('..') && !isAbsolute(child))
    await rm(temporary, { recursive: true, force: true });
}
