import { consentStorage } from './consent-fixture.mjs';
// Run after npm run build. Uses the production bundle with an isolated local test database.
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import { passwordHash } from '../backend/src/middleware/auth.mjs';
import { run, now, closeDatabases } from '../backend/src/config/db.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'techcare-content-browser-'));
process.env.TECHCARE_DATA_DIR = temporary;
const origin = 'http://127.0.0.1:3016',
  password = 'Synthetic-content-check-2026';
run(
  "INSERT INTO users(name,email,hash,role,verified,created) VALUES(?,?,?,'admin',1,?)",
  'Content QA',
  'content-qa@example.test',
  passwordHash(password),
  now(),
);
closeDatabases();
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', 'frontend', '--hostname', '127.0.0.1', '--port', '3016'],
  {
    env: {
      ...process.env,
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
server.stdout.on('data', (b) => (serverLog += b));
server.stderr.on('data', (b) => (serverLog += b));
const checks = [],
  errors = [];
const pass = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(origin + '/api/settings')).ok) break;
    } catch {}
    if (attempt === 59 || server.exitCode !== null)
      throw new Error(`Test server failed: ${serverLog}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    storageState: consentStorage(origin),
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const guestContext = await browser.newContext({
    storageState: consentStorage(origin),
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const login = await context.request.post(origin + '/api/login', {
    headers: { origin, 'x-techcare-request': '1' },
    data: { email: 'content-qa@example.test', password },
  });
  expect(login.status()).toBe(200);
  const page = await context.newPage(),
    guest = await guestContext.newPage();
  for (const p of [page, guest]) p.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + '/admin', { waitUntil: 'networkidle' });
  const manager = page.locator('.content-manager');
  await expect(manager.getByRole('heading', { name: 'Page content', exact: true })).toBeVisible();
  await manager.getByRole('link', { name: 'Add guide', exact: true }).click();
  let dialog = page.locator('.editor-page');
  await dialog.getByLabel('Title', { exact: true }).fill('QA printer setup guide');
  await dialog
    .getByLabel('Summary', { exact: true })
    .fill('Connect your printer using safe checks.');
  await dialog.getByLabel('Instruction 1', { exact: true }).fill('Check the printer connection.');
  await dialog.getByRole('button', { name: 'Add a step', exact: true }).click();
  await dialog.getByLabel('Instruction 2', { exact: true }).fill('Open the printer settings.');
  await dialog.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    manager.getByRole('heading', { name: 'QA printer setup guide', exact: true }),
  ).toBeVisible();
  await guest.goto(origin + '/guides', { waitUntil: 'networkidle' });
  await expect(guest.locator('.guide-library')).not.toContainText('QA printer setup guide');
  await manager
    .getByRole('button', { name: 'Publish QA printer setup guide', exact: true })
    .click();
  await expect(
    manager.getByRole('button', { name: 'Hide QA printer setup guide', exact: true }),
  ).toBeVisible();
  await guest.reload({ waitUntil: 'networkidle' });
  await guest
    .locator('.guide-library')
    .getByRole('button', { name: /QA printer setup guide/ })
    .click();
  await expect(
    guest.getByRole('dialog').getByText('Check the printer connection.', { exact: true }),
  ).toBeVisible();
  await guest.keyboard.press('Escape');
  await guest.getByRole('button', { name: 'Open guide assistant' }).click();
  await guest.getByRole('textbox', { name: 'Your question' }).fill('QA printer setup guide');
  await guest.getByRole('button', { name: 'Send question' }).click();
  await expect(
    guest.getByRole('log').getByText('Check the printer connection.', { exact: true }),
  ).toBeVisible();
  pass('Guide drafts stay private; published guide and assistant show saved steps');
  await manager.getByRole('link', { name: 'Edit QA printer setup guide', exact: true }).click();
  dialog = page.locator('.editor-page');
  await dialog.getByLabel('Title', { exact: true }).fill('QA updated printer guide');
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await manager.getByRole('button', { name: 'Hide QA updated printer guide', exact: true }).click();
  await expect(
    manager.getByRole('button', { name: 'Publish QA updated printer guide', exact: true }),
  ).toBeVisible();
  await guest.reload({ waitUntil: 'networkidle' });
  await expect(guest.locator('.guide-library')).not.toContainText('QA updated printer guide');
  await manager
    .getByRole('button', { name: 'Delete QA updated printer guide', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete content', exact: true })
    .click();
  await expect(
    manager.getByRole('heading', { name: 'QA updated printer guide', exact: true }),
  ).toHaveCount(0);
  pass('Guide editing, hiding and confirmed deletion work through the real API');
  await manager.getByRole('button', { name: 'Video & Media', exact: true }).click();
  await manager.getByRole('link', { name: 'Add media item', exact: true }).click();
  dialog = page.locator('.editor-page');
  await dialog.getByLabel('Title', { exact: true }).fill('QA learning video');
  await dialog.getByLabel('Source credit', { exact: true }).fill('QA teacher');
  await dialog.getByLabel('HTTPS link', { exact: true }).fill('https://example.org/learning-video');
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await manager.getByRole('button', { name: 'Video & Media', exact: true }).click();
  await guest.goto(origin + '/resources', { waitUntil: 'networkidle' });
  await expect(
    guest.getByRole('heading', { name: 'QA learning video', exact: true }),
  ).toBeVisible();
  await manager
    .getByRole('button', { name: 'Hide Five ways to care for your laptop', exact: true })
    .click();
  await expect(
    manager.getByRole('button', { name: 'Publish Five ways to care for your laptop', exact: true }),
  ).toBeVisible();
  await guest.reload({ waitUntil: 'networkidle' });
  await expect(
    guest.getByRole('heading', { name: 'Five ways to care for your laptop', exact: true }),
  ).toHaveCount(0);
  pass('Media publishing works and hidden seeded items do not reappear');
  await manager.getByRole('button', { name: 'Support Booth', exact: true }).click();
  await manager.getByRole('link', { name: 'Add booth', exact: true }).click();
  dialog = page.locator('.editor-page');
  await dialog.getByLabel('Title', { exact: true }).fill('QA library support day');
  await dialog
    .getByLabel('Description', { exact: true })
    .fill('Bring your everyday technology questions.');
  await dialog.getByLabel('Date (optional)', { exact: true }).fill('2027-02-20');
  await dialog.getByLabel('Venue', { exact: true }).fill('Library lobby');
  await dialog.getByLabel('Hours', { exact: true }).fill('9 AM to 3 PM');
  await dialog.getByLabel('Booth image', { exact: true }).selectOption('campus-building');
  await dialog
    .getByLabel('Image description', { exact: true })
    .fill('The campus building and gardens');
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await manager.getByRole('button', { name: 'Support Booth', exact: true }).click();
  await guest.goto(origin + '/booth', { waitUntil: 'networkidle' });
  await expect(
    guest.getByRole('heading', { name: 'QA library support day', exact: true }),
  ).toBeVisible();
  await expect(guest.locator('.managed-booth').first()).toContainText('Library lobby');
  await guest.goto(origin, { waitUntil: 'networkidle' });
  await expect(guest.locator('.booth-card')).toContainText('February 20, 2027');
  await expect(guest.locator('.booth-card')).toContainText('Library lobby');
  pass('New booth content updates its public page and the homepage preview');
  await mkdir('artifacts', { recursive: true });
  const desktop = await new AxeBuilder({ page })
    .include('.content-manager')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(desktop.violations).toEqual([]);
  await page.screenshot({ path: 'artifacts/content-admin-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await manager.getByRole('link', { name: 'Edit QA library support day', exact: true }).click();
  dialog = page.locator('.editor-page');
  const mobile = await new AxeBuilder({ page })
    .include('.editor-page')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(mobile.violations).toEqual([]);
  await page.screenshot({ path: 'artifacts/content-editor-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  pass('Admin controls and mobile editor pass accessibility and overflow checks');
  expect(errors).toEqual([]);
  await writeFile(
    'artifacts/content-management-check.json',
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
  }
  closeDatabases();
  const child = relative(tmpdir(), temporary);
  if (child.startsWith('techcare-content-browser-') && !child.includes('..') && !isAbsolute(child))
    await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
