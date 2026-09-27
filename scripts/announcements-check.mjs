import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute, resolve } from 'node:path';
import { passwordHash } from '../src/lib/server/auth.mjs';
import { run, now, closeDatabases } from '../src/lib/server/db.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'techcare-announcement-browser-'));
process.env.TECHCARE_DATA_DIR = temporary;
const origin = 'http://127.0.0.1:3014';
const password = 'Announcement-browser-check-2026';
run(
  "INSERT INTO users(name,email,hash,role,verified,created) VALUES('QA Admin','announcements@example.test',?,'admin',1,?)",
  passwordHash(password),
  now(),
);
closeDatabases();
await mkdir('artifacts', { recursive: true });
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3014'],
  {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      TECHCARE_DATA_DIR: temporary,
      TECHCARE_ORIGIN: origin,
      TECHCARE_DEV_VERIFY: '0',
      TECHCARE_BUILD_DIR: '.next-production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  },
);
let logs = '',
  browser;
server.stdout.on('data', (b) => (logs += b));
server.stderr.on('data', (b) => (logs += b));
const errors = [],
  scans = [],
  checks = [];
async function scan(page, name) {
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  scans.push({
    name,
    violations: result.violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  });
}
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(origin + '/api/settings')).ok) break;
    } catch {}
    if (i === 59) throw new Error('Announcement test server did not start');
    await new Promise((r) => setTimeout(r, 500));
  }
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const guestContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const admin = await adminContext.newPage(),
    guest = await guestContext.newPage();
  for (const page of [admin, guest]) page.on('pageerror', (e) => errors.push(e.message));
  const login = await admin.request.post(origin + '/api/login', {
    headers: { origin, 'x-techcare-request': '1' },
    data: { email: 'announcements@example.test', password },
  });
  expect(login.ok()).toBe(true);
  await admin.goto(origin + '/admin');
  const manager = admin.getByRole('region', { name: 'Manage announcements' });
  await expect(manager.getByRole('button', { name: 'Add announcement' })).toBeEnabled();
  await guest.goto(origin);
  await expect(guest.getByText('No announcements right now.')).toBeVisible();
  const day = guest.locator('.campus-day'),
    night = guest.locator('.campus-night');
  for (const [route, key] of [
    ['/', 'dormitory-courtyard'],
    ['/booth', 'covered-walkway'],
    ['/guides', 'campus-building'],
  ]) {
    await guest.goto(origin + route);
    await expect(day).toHaveAttribute('src', '/static/campus/' + key + '.webp');
    await expect(night).toHaveAttribute('src', '/static/campus/' + key + '-dark.webp');
    await expect.poll(() => day.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(day).toHaveCSS('opacity', '1');
    await expect(night).toHaveCSS('opacity', '0');
    await guest.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(night).toHaveCSS('opacity', '1');
    await expect(day).toHaveCSS('opacity', '0');
    await expect
      .poll(() => night.evaluate((img) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    await guest.getByRole('button', { name: 'Switch to light mode' }).click();
  }
  await guest.goto(origin);
  await expect(guest.locator('.announcement-image img')).not.toHaveAttribute(
    'src',
    /static\/campus/,
  );
  await scan(guest, 'Campus background light');
  await guest.screenshot({ path: 'artifacts/campus-background-light.png', fullPage: true });
  await guest.getByRole('button', { name: 'Switch to dark mode' }).click();
  await scan(guest, 'Campus background dark');
  await guest.screenshot({ path: 'artifacts/campus-background-dark.png', fullPage: true });
  await guest.reload();
  await expect(night).toHaveCSS('opacity', '1');
  await guest.setViewportSize({ width: 390, height: 844 });
  await scan(guest, 'Campus background mobile dark');
  await guest.screenshot({ path: 'artifacts/campus-background-mobile.png', fullPage: true });
  await guest.getByRole('button', { name: 'Switch to light mode' }).click();
  await scan(guest, 'Campus background mobile light');
  await guest.setViewportSize({ width: 1440, height: 1000 });
  checks.push(
    'Reference background: route-specific scenes, day/night layers, readable content panel, theme persistence, and separate announcements',
  );
  await manager.getByRole('button', { name: 'Add announcement' }).click();
  let dialog = admin.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Save announcement' }).click();
  await expect(dialog.getByText('Choose a file for announcement image.')).toBeVisible();
  await dialog
    .getByLabel('Announcement image', { exact: true })
    .setInputFiles(resolve('public/static/techcare-hero.webp'));
  await expect(dialog.getByAltText('Announcement image preview')).toBeVisible();
  await dialog.getByLabel('Title', { exact: true }).fill('Support booth update');
  await dialog
    .getByLabel('Short description (optional)')
    .fill('Planned campus support. Venue and hours to be confirmed.');
  await dialog
    .getByLabel('Image description', { exact: true })
    .fill('Student volunteers at a campus technology booth');
  await dialog.getByLabel('Event date (optional)').fill('2026-10-16');
  await dialog.getByLabel('Details link (optional)').fill('https://example.org/details');
  await scan(admin, 'Announcement editor');
  await admin.screenshot({ path: 'artifacts/announcement-editor.png' });
  await dialog.getByRole('button', { name: 'Save announcement' }).click();
  await expect(dialog).toHaveCount(0);
  let first = manager.getByRole('article', { name: 'Support booth update', exact: true });
  await expect(first.getByText('Draft', { exact: true })).toBeVisible();
  await admin.reload();
  await expect(first).toBeVisible();
  await guest.reload();
  await expect(guest.getByText('No announcements right now.')).toBeVisible();
  checks.push('Upload preview, required fields, draft persistence, and public draft exclusion');
  await first.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(first.getByText('Published', { exact: true })).toBeVisible();
  await guest.reload();
  await expect(guest.locator('.announcement-copy h3')).toHaveText('Support booth update');
  await expect(guest.locator('.announcement-copy time')).toHaveText('October 16, 2026');
  await expect(guest.getByRole('link', { name: /View details/ })).toHaveAttribute(
    'href',
    'https://example.org/details',
  );
  await expect(guest.getByRole('button', { name: 'Next announcement' })).toHaveCount(0);
  await manager.getByRole('button', { name: 'Add announcement' }).click();
  dialog = admin.getByRole('dialog');
  await dialog
    .getByLabel('Announcement image', { exact: true })
    .setInputFiles(resolve('public/static/device-care-guide.png'));
  await dialog.getByLabel('Title', { exact: true }).fill('Care for your laptop');
  await dialog.getByLabel('Image description', { exact: true }).fill('Device care tips poster');
  await dialog.getByLabel('Visibility', { exact: true }).selectOption('published');
  await dialog.getByRole('button', { name: 'Save announcement' }).click();
  await expect(dialog).toHaveCount(0);
  let second = manager.getByRole('article', { name: 'Care for your laptop', exact: true });
  await second.getByRole('button', { name: 'Move up: Care for your laptop', exact: true }).click();
  await expect(manager.getByRole('article').first()).toHaveAttribute(
    'aria-label',
    'Care for your laptop',
  );
  await guest.reload();
  await expect(guest.locator('.announcement-copy h3')).toHaveText('Care for your laptop');
  await guest.getByRole('button', { name: 'Next announcement', exact: true }).click();
  await expect(guest.locator('.announcement-copy h3')).toHaveText('Support booth update');
  await guest.getByRole('button', { name: 'Previous announcement', exact: true }).click();
  await expect(guest.locator('.announcement-copy h3')).toHaveText('Care for your laptop');
  await guest.getByRole('button', { name: 'Enlarge image: Care for your laptop' }).click();
  await expect(guest.getByRole('dialog').getByAltText('Device care tips poster')).toBeVisible();
  await guest.keyboard.press('Escape');
  await expect(
    guest.getByRole('button', { name: 'Enlarge image: Care for your laptop' }),
  ).toBeFocused();
  await guest.getByRole('button', { name: 'Next announcement', exact: true }).click();
  checks.push(
    'Publish, ordering, readable dates and links, carousel arrows, image enlargement and keyboard focus',
  );
  await scan(guest, 'Published desktop');
  await guest.screenshot({ path: 'artifacts/announcements-desktop.png', fullPage: true });
  await scan(admin, 'Admin list');
  await admin.screenshot({ path: 'artifacts/announcements-admin.png', fullPage: true });
  await guest.getByRole('button', { name: 'Switch to dark mode' }).click();
  await scan(guest, 'Published dark');
  await guest.screenshot({ path: 'artifacts/announcements-dark.png', fullPage: true });
  await guest.getByRole('button', { name: 'Switch to light mode' }).click();
  for (const width of [390, 320]) {
    await guest.setViewportSize({ width, height: 844 });
    await scan(guest, `Published ${width}px`);
    if (width === 390)
      await guest.screenshot({ path: 'artifacts/announcements-mobile.png', fullPage: true });
  }
  await admin.setViewportSize({ width: 390, height: 844 });
  await scan(admin, 'Admin mobile');
  await first.getByRole('button', { name: 'Edit', exact: true }).click();
  await admin
    .getByLabel('Replace image (optional)')
    .setInputFiles(resolve('public/static/device-care-guide.png'));
  await admin
    .getByRole('dialog')
    .getByLabel('Title', { exact: true })
    .fill('Updated support notice');
  await scan(admin, 'Editor mobile');
  await admin.getByRole('button', { name: 'Save announcement' }).click();
  first = manager.getByRole('article', { name: 'Updated support notice', exact: true });
  await expect(first).toBeVisible();
  await first.getByRole('button', { name: 'Hide', exact: true }).click();
  await expect(first.getByText('Draft', { exact: true })).toBeVisible();
  await guest.reload();
  await expect(guest.locator('.announcement-copy h3')).toHaveText('Care for your laptop');
  await second.getByRole('button', { name: 'Delete', exact: true }).click();
  await admin.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(second).toBeVisible();
  await second.getByRole('button', { name: 'Delete', exact: true }).click();
  await admin.getByRole('button', { name: 'Delete announcement', exact: true }).click();
  await expect(second).toHaveCount(0);
  await guest.reload();
  await expect(guest.getByText('No announcements right now.')).toBeVisible();
  checks.push('Image replacement, title editing, hide, delete confirmation, and empty fallback');
  await manager.getByRole('button', { name: 'Add announcement' }).click();
  dialog = admin.getByRole('dialog');
  await dialog.getByLabel('Image source', { exact: true }).selectOption('covered-walkway');
  await expect(dialog.getByAltText('Announcement image preview')).toHaveAttribute(
    'src',
    '/static/campus/covered-walkway.webp',
  );
  await dialog.getByLabel('Title', { exact: true }).fill('Campus photo announcement');
  await dialog.getByLabel('Visibility', { exact: true }).selectOption('published');
  await scan(admin, 'Campus photo editor');
  await dialog.getByRole('button', { name: 'Save announcement' }).click();
  await expect(dialog).toHaveCount(0);
  await guest.reload();
  await expect(guest.locator('.announcement-image img')).toHaveAttribute(
    'src',
    '/static/campus/covered-walkway.webp',
  );
  await guest.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(guest.locator('.announcement-image img')).toHaveAttribute(
    'src',
    '/static/campus/covered-walkway-dark.webp',
  );
  await admin.getByRole('button', { name: 'Switch to dark mode' }).click();
  const campusItem = manager.getByRole('article', {
    name: 'Campus photo announcement',
    exact: true,
  });
  await expect(campusItem.locator('img')).toHaveAttribute(
    'src',
    '/static/campus/covered-walkway-dark.webp',
  );
  await campusItem.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(
    admin.getByRole('dialog').getByAltText('Announcement image preview'),
  ).toHaveAttribute('src', '/static/campus/covered-walkway-dark.webp');
  checks.push(
    'Admin can publish a campus photo with automatic image description; public, admin thumbnail and editor follow theme',
  );
  if (errors.length || scans.some((s) => s.violations.length))
    throw new Error('Browser errors or accessibility violations detected');
  console.log(JSON.stringify({ checks, errors, scans }, null, 2));
} catch (error) {
  console.error(error);
  await writeFile('artifacts/announcements-failure.log', String(error) + '\n' + logs);
  process.exitCode = 1;
} finally {
  await writeFile(
    'artifacts/announcements-check.json',
    JSON.stringify({ checks, errors, scans }, null, 2),
  );
  await browser?.close();
  if (server.exitCode === null) {
    const exited = new Promise((r) => server.once('exit', r));
    server.kill();
    await exited;
  }
  closeDatabases();
  const child = relative(tmpdir(), temporary);
  if (
    child.startsWith('techcare-announcement-browser-') &&
    !child.includes('..') &&
    !isAbsolute(child)
  )
    await rm(temporary, { recursive: true, force: true });
}
