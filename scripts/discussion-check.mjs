// Run after npm run build. Uses the production bundle with an isolated local test database.
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import { passwordHash } from '../src/lib/server/auth.mjs';
import { run, now, closeDatabases } from '../src/lib/server/db.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'techcare-discussion-browser-'));
process.env.TECHCARE_DATA_DIR = temporary;
const origin = 'http://127.0.0.1:3018',
  password = 'Synthetic-content-check-2026';
run(
  "INSERT INTO users(name,email,hash,role,verified,created) VALUES(?,?,?,'admin',1,?)",
  'Discussion QA',
  'content-qa@example.test',
  passwordHash(password),
  now(),
);
run(
  "INSERT INTO users(name,email,hash,role,verified,created) VALUES(?,?,?,'member',1,?)",
  'QA Member',
  'member-discussion@example.test',
  passwordHash(password),
  now(),
);
for (let i = 1; i <= 3; i++)
  run(
    "INSERT INTO posts(id,user_id,title,body,category,status,created) VALUES(?,2,?,?,?,'published',?)",
    i,
    [
      'How can I speed up my laptop?',
      'How do I spot a suspicious message?',
      'Why does my Wi-Fi keep disconnecting?',
    ][i - 1],
    'I have tried restarting my device and checking the settings. What safe checks should I try next?',
    i === 3 ? 'Connectivity' : 'General',
    now() + i,
  );
run(
  "INSERT INTO comments(id,post_id,user_id,body,status,created) VALUES(1,3,1,'Check whether other devices lose the connection too. This helps narrow down the problem.','published',?)",
  now(),
);
closeDatabases();
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3018'],
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
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const guestContext = await browser.newContext({
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
  const memberContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  await memberContext.request.post(origin + '/api/login', {
    headers: { origin, 'x-techcare-request': '1' },
    data: { email: 'member-discussion@example.test', password },
  });
  const member = await memberContext.newPage();
  member.on('pageerror', (e) => errors.push(e.message));
  await member.goto(origin + '/discussion', { waitUntil: 'networkidle' });
  await expect(member.locator('.discussion-post')).toHaveCount(3);
  const first = member.locator('.discussion-post').first();
  await first.getByRole('button', { name: 'Upvote question', exact: true }).click();
  await expect(first.locator('.vote-score')).toHaveText('1');
  await first
    .getByRole('link', { name: 'Why does my Wi-Fi keep disconnecting?', exact: true })
    .click();
  await expect(member).toHaveURL(origin + '/discussion/3');
  await expect(
    member.getByRole('heading', { level: 1, name: 'Why does my Wi-Fi keep disconnecting?' }),
  ).toBeVisible();
  await expect(member.getByRole('dialog')).toHaveCount(0);
  await expect(member.locator('.full-question .vote-score')).toHaveText('1');
  await member.reload({ waitUntil: 'networkidle' });
  await expect(
    member.locator('.full-question').getByRole('button', { name: 'Upvote question' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await member.locator('.full-question').getByRole('button', { name: 'Downvote question' }).click();
  await expect(member.locator('.full-question .vote-score')).toHaveText('-1');
  await member.locator('.full-question').getByRole('button', { name: 'Downvote question' }).click();
  await expect(member.locator('.full-question .vote-score')).toHaveText('0');
  await member
    .locator('.discussion-comment')
    .getByRole('button', { name: 'Upvote comment' })
    .click();
  await expect(member.locator('.discussion-comment .vote-score')).toHaveText('1');
  pass('Full question page replaces modal; question and comment votes persist and toggle');
  await member
    .getByLabel('Your comment', { exact: true })
    .fill('I checked another device and it stays connected.');
  await member.getByRole('button', { name: 'Send comment for review', exact: true }).click();
  await expect(
    member.getByRole('status').filter({ hasText: 'Reply submitted for moderator review.' }),
  ).toBeVisible();
  await expect(member.locator('.discussion-comment')).toHaveCount(1);
  const queue = await (await context.request.get(origin + '/api/queue')).json();
  const pending = queue.comments.find(
    (c) => c.body === 'I checked another device and it stays connected.',
  );
  expect(pending).toBeTruthy();
  const approved = await context.request.post(origin + '/api/moderate', {
    headers: { origin, 'x-techcare-request': '1' },
    data: { kind: 'comment', id: pending.id, status: 'published' },
  });
  expect(approved.status()).toBe(200);
  await member.reload({ waitUntil: 'networkidle' });
  await expect(member.locator('.discussion-comment')).toHaveCount(2);
  await page.goto(origin + '/discussion/3', { waitUntil: 'networkidle' });
  await page
    .getByLabel('Your comment', { exact: true })
    .fill('Try updating the wireless driver from the device manufacturer.');
  await page.getByRole('button', { name: 'Publish comment', exact: true }).click();
  await expect(
    page.locator('.discussion-comment').filter({ hasText: 'Try updating the wireless driver' }),
  ).toBeVisible();
  pass('Member comments await moderation and staff comments publish inline');
  await guest.goto(origin + '/discussion/3', { waitUntil: 'networkidle' });
  await expect(guest.getByRole('button', { name: 'Sign in to comment' })).toBeVisible();
  await guest.getByRole('button', { name: 'Upvote question', exact: true }).click();
  await expect(guest.getByRole('dialog', { name: 'Welcome back' })).toBeVisible();
  await guest.keyboard.press('Escape');
  await guest.goto(origin + '/discussion?thread=1', { waitUntil: 'networkidle' });
  await expect(guest).toHaveURL(origin + '/discussion/1');
  await expect(
    guest.getByRole('heading', { level: 1, name: 'How can I speed up my laptop?' }),
  ).toBeVisible();
  await guest.goto(origin + '/discussion/99999', { waitUntil: 'networkidle' });
  await expect(guest.getByRole('heading', { name: 'Question unavailable' })).toBeVisible();
  pass(
    'Guests can read, participation requires sign-in, legacy links and missing questions are handled',
  );
  await member.goto(origin + '/discussion', { waitUntil: 'networkidle' });
  await member
    .locator('.discussion-post')
    .filter({ hasText: 'How can I speed up my laptop?' })
    .getByRole('button', { name: 'Upvote question' })
    .click();
  await member.getByRole('button', { name: 'Top', exact: true }).click();
  await expect(member.locator('.discussion-post').first()).toContainText(
    'How can I speed up my laptop?',
  );
  await member.getByRole('button', { name: 'Connectivity', exact: true }).click();
  await expect(member.locator('.discussion-post')).toHaveCount(1);
  await expect(member.locator('.discussion-post')).toContainText('Why does my Wi-Fi');
  await member.getByRole('button', { name: 'All topics', exact: true }).click();
  pass('Top sorting and category filtering work with the saved vote scores');
  await mkdir('artifacts', { recursive: true });
  await member.screenshot({ path: 'artifacts/discussion-feed-desktop.png', fullPage: true });
  await member.goto(origin + '/discussion/3', { waitUntil: 'networkidle' });
  const desktop = await new AxeBuilder({ page: member })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(desktop.violations).toEqual([]);
  await member.screenshot({ path: 'artifacts/discussion-thread-desktop.png', fullPage: true });
  await member.getByRole('button', { name: 'Switch to dark mode' }).click();
  const dark = await new AxeBuilder({ page: member })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(dark.violations).toEqual([]);
  await member.setViewportSize({ width: 390, height: 844 });
  await member.waitForFunction(
    () => document.querySelector('.sidebar').getBoundingClientRect().right <= 1,
  );
  expect(await member.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
    false,
  );
  await expect(member.getByLabel('Your comment', { exact: true })).toBeVisible();
  await member.screenshot({ path: 'artifacts/discussion-thread-mobile.png', fullPage: true });
  pass('Desktop, dark mode and mobile layouts pass accessibility and overflow checks');
  expect(errors).toEqual([]);
  await writeFile('artifacts/discussion-check.json', JSON.stringify({ checks, errors }, null, 2));
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
  }
  closeDatabases();
  const child = relative(tmpdir(), temporary);
  if (
    child.startsWith('techcare-discussion-browser-') &&
    !child.includes('..') &&
    !isAbsolute(child)
  )
    await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
