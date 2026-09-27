import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { passwordHash } from '../src/lib/server/auth.mjs';
import { run, now, closeDatabases } from '../src/lib/server/db.mjs';
const temporary = await mkdtemp(join(tmpdir(), 'techcare-browser-'));
process.env.TECHCARE_DATA_DIR = temporary;
const origin = 'http://127.0.0.1:3012',
  password = 'Synthetic-browser-check-2026';
run(
  "INSERT INTO users(name,email,hash,role,verified,created) VALUES(?,?,?,'admin',1,?)",
  'QA Administrator',
  'qa-admin@example.test',
  passwordHash(password),
  now(),
);
closeDatabases();
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3012'],
  {
    env: {
      ...process.env,
      TECHCARE_ORIGIN: origin,
      TECHCARE_DEV_VERIFY: '1',
      TECHCARE_BUILD_DIR: '.next-e2e',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  },
);
let serverLog = '';
server.stdout.on('data', (b) => {
  serverLog += b;
});
server.stderr.on('data', (b) => {
  serverLog += b;
});
const checks = [],
  errors = [],
  violations = [];
let browser;
const pass = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
try {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const r = await fetch(origin + '/api/settings');
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
    if (attempt === 79) throw new Error('Test server failed to start');
  }
  browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  const memberContext = await browser.newContext({
      viewport: { width: 1365, height: 950 },
      reducedMotion: 'reduce',
    }),
    adminContext = await browser.newContext({
      viewport: { width: 1365, height: 950 },
      reducedMotion: 'reduce',
    });
  const member = await memberContext.newPage(),
    admin = await adminContext.newPage();
  for (const p of [member, admin]) p.on('pageerror', (e) => errors.push(e.message));
  await member.goto(origin, { waitUntil: 'networkidle' });
  await mkdir('artifacts', { recursive: true });
  await member.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(member.locator('html')).toHaveAttribute('data-theme', 'dark');
  await member.reload({ waitUntil: 'networkidle' });
  await expect(member.locator('html')).toHaveAttribute('data-theme', 'dark');
  await member.screenshot({ path: 'artifacts/home-dark.png', fullPage: true });
  expect((await member.request.get(origin + '/favicon.ico')).status()).toBe(200);
  expect((await member.request.get(origin + '/api/branding-icon')).headers()['content-type']).toBe(
    'image/png',
  );
  pass('Dark mode persists after reload; favicon endpoints load');
  await member.getByRole('button', { name: 'Create Account', exact: true }).click();
  let dialog = member.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(dialog.getByLabel('Display name', { exact: true })).toBeFocused();
  await expect(dialog.getByText('Please enter display name.', { exact: true })).toBeVisible();
  await dialog.getByLabel('Email address', { exact: true }).fill('incorrect');
  await dialog.getByLabel('Password (12 to 128 characters)', { exact: true }).fill('short');
  await dialog.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(
    dialog.getByText('Enter a valid email address, such as name@example.com.'),
  ).toBeVisible();
  await expect(
    dialog.getByLabel('Password (12 to 128 characters)', { exact: true }),
  ).toHaveAttribute('aria-invalid', 'true');
  await member.screenshot({ path: 'artifacts/custom-input-errors-dark.png' });
  const errorScan = await new AxeBuilder({ page: member })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(errorScan.violations).toEqual([]);
  pass('Custom required/email/length errors, accessible labels and first-error focus');
  await dialog.getByLabel('Display name').fill('QA Student');
  await dialog.getByLabel('Email address').fill('qa-student@example.test');
  await dialog.getByLabel('Password (12 to 128 characters)', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Verify Your Email' })).toBeVisible();
  const code = (await dialog.locator('.demo-note').textContent()).match(/Demo code: (\d{6})/)[1];
  await dialog.getByLabel('Six-digit code').fill(code);
  await dialog.getByRole('button', { name: 'Verify email', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await dialog.getByLabel('Password', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(member.getByRole('heading', { name: 'Welcome back, QA' })).toBeVisible();
  pass('Create Account → Verify Email → Sign In → Dashboard');
  await member
    .getByLabel('About me')
    .fill('A synthetic student account for browser acceptance testing.');
  await member.getByLabel('Profile visibility').selectOption('private');
  await member.getByRole('button', { name: 'Save profile' }).click();
  await expect(member.getByRole('status').filter({ hasText: 'Profile updated' })).toBeVisible();
  pass('Profile editing and private visibility');
  await member.getByRole('button', { name: 'Ask a Question', exact: true }).click();
  dialog = member.getByRole('dialog');
  await dialog.getByLabel('Question title').fill('How can I make my laptop start faster?');
  await dialog.getByLabel('Category').selectOption('Operating system');
  await dialog
    .getByLabel('Describe the problem')
    .fill(
      'My laptop takes a long time to start. I have restarted it and checked the available storage. What should I try next?',
    );
  const photoFixture = await sharp({
    create: { width: 2200, height: 1400, channels: 3, background: '#2458bc' },
  })
    .png()
    .toBuffer();
  await dialog
    .getByLabel('Choose question photo')
    .setInputFiles({ name: 'issue.png', mimeType: 'image/png', buffer: photoFixture });
  await expect(dialog.getByAltText('Selected question photo')).toBeVisible();
  expect(
    await dialog.getByAltText('Selected question photo').evaluate((image) => image.naturalWidth),
  ).toBeLessThanOrEqual(1920);
  await dialog.getByRole('button', { name: 'Remove photo' }).click();
  await expect(dialog.getByAltText('Selected question photo')).toHaveCount(0);
  await member.evaluate(() => {
    window.qaGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('Denied for test', 'NotAllowedError'));
  });
  await dialog.getByRole('button', { name: 'Use camera', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Camera permission was not granted');
  await expect(dialog.getByRole('button', { name: 'Submit for review' })).toBeEnabled();
  await expect(dialog.getByLabel('Take photo with device camera')).toHaveAttribute(
    'capture',
    'environment',
  );
  await member.evaluate(() => {
    navigator.mediaDevices.getUserMedia = window.qaGetUserMedia;
  });
  await dialog.getByRole('button', { name: 'Use camera', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Capture photo', exact: true })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: 'Submit for review' })).toBeDisabled();
  await member.evaluate(() => {
    window.qaCameraTracks = document.querySelector('.question-camera video').srcObject.getTracks();
  });
  await dialog.getByRole('button', { name: 'Capture photo', exact: true }).click();
  await expect(dialog.getByAltText('Selected question photo')).toBeVisible();
  expect(
    await member.evaluate(() =>
      window.qaCameraTracks.every((track) => track.readyState === 'ended'),
    ),
  ).toBe(true);
  await dialog.getByRole('button', { name: 'Retake photo', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Capture photo', exact: true })).toBeEnabled();
  await member.evaluate(() => {
    window.qaCameraTracks = document.querySelector('.question-camera video').srcObject.getTracks();
  });
  await dialog.getByRole('button', { name: 'Cancel camera' }).click();
  expect(
    await member.evaluate(() =>
      window.qaCameraTracks.every((track) => track.readyState === 'ended'),
    ),
  ).toBe(true);
  await expect(dialog.getByAltText('Selected question photo')).toBeVisible();
  await member.setViewportSize({ width: 390, height: 844 });
  await member.screenshot({ path: 'artifacts/question-photo-mobile.png' });
  expect(await member.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
    false,
  );
  const photoScan = await new AxeBuilder({ page: member })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(photoScan.violations).toEqual([]);
  await member.setViewportSize({ width: 1365, height: 950 });
  pass(
    'Photo upload, resize, remove, camera permission fallback, capture/retake/cancel and mobile accessibility',
  );
  await dialog.getByRole('button', { name: 'Submit for review' }).click();
  await expect(
    member.locator('.own-question').filter({ hasText: 'How can I make my laptop start faster?' }),
  ).toContainText('pending');
  pass('Question modal → pending status in dashboard');
  const savedPhoto = await member
    .getByRole('link', { name: 'View attached photo' })
    .getAttribute('href');
  expect((await member.request.get(origin + savedPhoto)).status()).toBe(200);
  expect((await fetch(origin + savedPhoto)).status).toBe(403);
  await admin.goto(origin, { waitUntil: 'networkidle' });
  await admin.getByRole('button', { name: 'Sign In', exact: true }).click();
  let ad = admin.getByRole('dialog');
  await ad.getByLabel('Email address').fill('qa-admin@example.test');
  await ad.getByLabel('Password', { exact: true }).fill(password);
  await ad.getByRole('button', { name: 'Sign In', exact: true }).click();
  await admin.getByRole('button', { name: 'Switch to dark mode' }).click();
  await admin.getByRole('link', { name: 'Moderator', exact: true }).click();
  await expect(
    admin.getByAltText('Photo attached to: How can I make my laptop start faster?'),
  ).toBeVisible();
  expect(
    await admin
      .getByAltText('Photo attached to: How can I make my laptop start faster?')
      .evaluate((img) => img.complete && img.naturalWidth > 0),
  ).toBe(true);
  await admin.getByRole('button', { name: 'Approve & Answer', exact: true }).click();
  ad = admin.getByRole('dialog');
  await ad
    .getByLabel('Your moderator answer')
    .fill(
      'Review the optional startup apps in Task Manager, then apply official Windows updates and restart.',
    );
  await ad
    .getByLabel('Internal decision note (optional)')
    .fill('Synthetic browser acceptance check.');
  await ad.getByRole('button', { name: 'Publish question & answer' }).click();
  await expect(admin.getByText('The question queue is clear')).toBeVisible();
  pass('Moderator atomic Approve & Answer');
  expect((await fetch(origin + savedPhoto)).status).toBe(200);
  await member.getByRole('link', { name: 'Discussion', exact: true }).click();
  await member.getByRole('button', { name: 'How can I make my laptop start faster?' }).click();
  dialog = member.getByRole('dialog');
  await expect(
    dialog.getByAltText('Photo attached to: How can I make my laptop start faster?'),
  ).toBeVisible();
  await expect(
    dialog.getByText(
      'Review the optional startup apps in Task Manager, then apply official Windows updates and restart.',
    ),
  ).toBeVisible();
  await dialog.getByLabel('Your reply').fill('Thank you. I will try these safe steps.');
  await dialog.getByRole('button', { name: 'Send reply for review' }).click();
  await expect(member.getByRole('status').filter({ hasText: 'Reply submitted' })).toBeVisible();
  await member.keyboard.press('Escape');
  pass('Member sees staff answer and submits moderated reply');
  await member.getByRole('link', { name: 'Members', exact: true }).click();
  const adminCard = member
    .locator('.member-card')
    .filter({ has: member.getByRole('heading', { name: 'QA Administrator' }) });
  await adminCard.getByRole('button', { name: 'Add friend' }).click();
  await expect(adminCard.getByRole('button', { name: 'Cancel request' })).toBeVisible();
  await admin.getByRole('link', { name: 'Members', exact: true }).click();
  let studentCard = admin
    .locator('.member-card')
    .filter({ has: admin.getByRole('heading', { name: 'QA Student' }) });
  await studentCard.getByRole('button', { name: 'Accept request' }).click();
  await expect(studentCard.getByRole('button', { name: 'Message', exact: true })).toBeVisible();
  await member.reload({ waitUntil: 'networkidle' });
  await adminCard.getByRole('button', { name: 'Message', exact: true }).click();
  dialog = member.getByRole('dialog');
  await dialog
    .getByLabel('New message')
    .fill('Hello! Thanks for helping with the laptop question.');
  const accessCheck = member.waitForResponse((r) => r.url().includes('/api/messages/access'));
  await member.evaluate(() => window.dispatchEvent(new Event('focus')));
  await accessCheck;
  await expect(dialog.getByLabel('New message')).toHaveValue(
    'Hello! Thanks for helping with the laptop question.',
  );
  pass('Unsent message survives a background friendship check');
  await dialog.getByRole('button', { name: 'Send message' }).click();
  await expect(
    dialog.getByText('Hello! Thanks for helping with the laptop question.'),
  ).toBeVisible();
  await member.keyboard.press('Escape');
  pass('Friend request → accept → private message');
  await admin.getByRole('button', { name: 'Message', exact: true }).click();
  ad = admin.getByRole('dialog');
  await expect(ad.getByText('Hello! Thanks for helping with the laptop question.')).toBeVisible();
  await ad.getByRole('button', { name: 'Report this message' }).click();
  await ad
    .getByLabel('Reason for reporting')
    .fill('Synthetic report to verify the evidence access workflow.');
  await ad.getByRole('button', { name: 'Send report' }).click();
  await expect(admin.getByRole('status').filter({ hasText: 'Report received' })).toBeVisible();
  await admin.keyboard.press('Escape');
  pass('Received-message report');
  await member.getByRole('link', { name: 'Lost & Found', exact: true }).click();
  await member.getByRole('button', { name: 'Report an item' }).click();
  dialog = member.getByRole('dialog');
  await dialog.getByLabel('Report type').selectOption('found');
  await dialog.getByLabel('Item name').fill('Blue laptop sleeve');
  await dialog.getByLabel('Location last seen or found').fill('Campus library');
  await dialog
    .getByLabel('Public description')
    .fill('A plain blue laptop sleeve with a fabric handle.');
  await dialog.getByRole('button', { name: 'Send for review' }).click();
  await expect(
    member.getByRole('status').filter({ hasText: 'report has been submitted' }),
  ).toBeVisible();
  pass('Lost & Found report submission');
  await member.getByRole('link', { name: 'Feedback', exact: true }).click();
  await member
    .getByLabel('What worked well? What could be better?')
    .fill('The instructions were clear and helped me understand the next steps.');
  await member.getByRole('button', { name: 'Send feedback' }).click();
  await expect(member.getByText('Thank you for helping us improve.')).toBeVisible();
  pass('Private feedback submission');
  await admin.getByRole('link', { name: 'Moderator', exact: true }).click();
  await admin.getByRole('button', { name: 'Replies', exact: true }).click();
  await admin.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(admin.getByText('No replies awaiting review')).toBeVisible();
  await admin.getByRole('button', { name: 'Lost & Found', exact: true }).click();
  await admin.getByRole('button', { name: 'Approve', exact: true }).click();
  await admin.getByRole('button', { name: 'Feedback', exact: true }).click();
  await expect(
    admin.getByText('The instructions were clear and helped me understand the next steps.'),
  ).toBeVisible();
  await admin.getByRole('button', { name: 'Message reports', exact: true }).click();
  await expect(
    admin.getByText('Synthetic report to verify the evidence access workflow.'),
  ).toBeVisible();
  pass('Staff reviews replies, reports, feedback, and narrow message evidence');
  await admin.getByRole('button', { name: 'Publish resource', exact: true }).click();
  ad = admin.getByRole('dialog');
  await ad.getByLabel('Title', { exact: true }).fill('Approved sample learning resource');
  await ad
    .getByLabel('Description / transcript')
    .fill('A synthetic link used to test resource publication.');
  await ad.getByLabel('Student or source credit').fill('QA team');
  await ad.getByLabel('Direct HTTPS link').fill('https://example.com/learning');
  await ad.getByRole('button', { name: 'Publish resource', exact: true }).click();
  await expect(admin.getByRole('status').filter({ hasText: 'Resource published' })).toBeVisible();
  pass('Staff resource publishing');
  await admin.getByRole('link', { name: 'Admin', exact: true }).click();
  await admin.getByRole('button', { name: 'Make moderator', exact: true }).click();
  await expect(admin.getByRole('button', { name: 'Remove moderator', exact: true })).toBeVisible();
  await admin.getByRole('button', { name: 'Remove moderator', exact: true }).click();
  await expect(admin.getByRole('button', { name: 'Make moderator', exact: true })).toBeVisible();
  pass('Admin role assignment and removal');
  await admin.getByRole('button', { name: 'Save logo', exact: true }).click();
  await expect(admin.getByText('Choose a file for new app logo.')).toBeVisible();
  await admin.getByLabel('New app logo', { exact: true }).setInputFiles({
    name: 'unsupported.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg/>'),
  });
  await admin.getByRole('button', { name: 'Save logo', exact: true }).click();
  await expect(
    admin.getByText('Choose a PNG, JPEG, or WebP image.', { exact: true }),
  ).toBeVisible();
  await admin
    .getByLabel('New app logo', { exact: true })
    .setInputFiles(resolve('public/static/techcare-icon.png'));
  await expect(admin.getByAltText('Selected logo preview')).toBeVisible();
  await expect(admin.locator('.custom-brand img')).toHaveCount(0);
  await admin.getByRole('button', { name: 'Save logo', exact: true }).click();
  await expect(admin.getByRole('status').filter({ hasText: 'App logo updated.' })).toBeVisible();
  const savedLogo = await admin.locator('.custom-brand img').getAttribute('src');
  await expect(admin.locator('link[rel="icon"]')).toHaveAttribute(
    'href',
    `/api/branding-icon?v=${encodeURIComponent(savedLogo)}`,
  );
  await admin.reload({ waitUntil: 'networkidle' });
  await expect(admin.locator('.custom-brand img')).toHaveAttribute('src', savedLogo);
  await admin.screenshot({ path: 'artifacts/admin-branding-dark.png', fullPage: true });
  await admin.getByRole('button', { name: 'Restore original logo' }).click();
  await expect(admin.locator('.custom-brand img')).toHaveCount(0);
  await expect(
    admin.getByRole('status').filter({ hasText: 'Original TechCare logo restored.' }),
  ).toBeVisible();
  pass('Admin logo validation, preview, save, persistence, favicon update and restore');
  const fixture = resolve('public/static/techcare-hero.png');
  await admin.getByLabel('New homepage illustration').setInputFiles(fixture);
  await admin.getByRole('button', { name: 'Update illustration' }).click();
  await expect(
    admin.getByRole('status').filter({ hasText: 'Homepage illustration updated' }),
  ).toBeVisible();
  pass('Admin image validation and homepage replacement');
  // Keyboard containment and focus restoration.
  await member.getByRole('link', { name: 'Home', exact: true }).click();
  await member.getByRole('button', { name: 'Ask a Question', exact: true }).click();
  for (let i = 0; i < 12; i++) await member.keyboard.press('Tab');
  expect(await member.evaluate(() => !!document.activeElement.closest('[role=dialog]'))).toBe(true);
  await member.getByRole('dialog').getByRole('button', { name: 'Use camera', exact: true }).click();
  await expect(
    member.getByRole('dialog').getByRole('button', { name: 'Capture photo', exact: true }),
  ).toBeEnabled();
  await member.evaluate(() => {
    window.qaCameraTracks = document.querySelector('.question-camera video').srcObject.getTracks();
  });
  await member.keyboard.press('Escape');
  expect(
    await member.evaluate(() =>
      window.qaCameraTracks.every((track) => track.readyState === 'ended'),
    ),
  ).toBe(true);
  expect(
    await member
      .getByRole('button', { name: 'Ask a Question', exact: true })
      .evaluate((el) => el === document.activeElement),
  ).toBe(true);
  pass('Dialog traps focus, stops camera on close, and restores focus on Escape');
  await mkdir('artifacts', { recursive: true });
  for (const route of [
    '/',
    '/guides',
    '/resources',
    '/discussion',
    '/members',
    '/booth',
    '/lostfound',
    '/feedback',
    '/profile',
    '/privacy',
  ]) {
    await member.goto(origin + route, { waitUntil: 'networkidle' });
    const scan = await new AxeBuilder({ page: member })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    if (scan.violations.length)
      violations.push({
        route,
        issues: scan.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      });
  }
  for (const route of ['/moderate', '/admin']) {
    await admin.goto(origin + route, { waitUntil: 'networkidle' });
    const scan = await new AxeBuilder({ page: admin })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    if (scan.violations.length)
      violations.push({
        route,
        issues: scan.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      });
  }
  await member.setViewportSize({ width: 390, height: 844 });
  await member.goto(origin, { waitUntil: 'networkidle' });
  await member.getByRole('button', { name: 'Open navigation' }).click();
  await member
    .getByRole('navigation')
    .getByRole('link', { name: 'Discussion', exact: true })
    .click();
  await member.getByRole('button', { name: 'How can I make my laptop start faster?' }).click();
  await expect(member.getByRole('dialog')).toBeVisible();
  expect(await member.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await member.screenshot({ path: 'artifacts/thread-mobile.png', fullPage: true });
  await member.keyboard.press('Escape');
  pass('Mobile navigation and discussion dialog without horizontal overflow');
  await member.setViewportSize({ width: 320, height: 740 });
  await member.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(member.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await member.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await member.reload({ waitUntil: 'networkidle' });
  await expect(member.locator('html')).toHaveAttribute('data-theme', 'light');
  pass('Mobile theme toggle and saved light-mode preference');
  await member.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(member.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  await member.goto(origin + '/profile');
  await expect(
    member.getByRole('heading', { name: 'Your community is one sign-in away' }),
  ).toBeVisible();
  pass('Sign out clears private screens');
  await writeFile(
    'artifacts/workflow-check.json',
    JSON.stringify({ checks, errors, violations }, null, 2),
  );
  console.log(
    JSON.stringify({ passed: checks.length, errors, accessibilityViolations: violations }, null, 2),
  );
  if (errors.length || violations.length) process.exitCode = 1;
} catch (error) {
  console.error(error);
  await writeFile('artifacts/workflow-failure.log', String(error) + '\n' + serverLog);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
  await new Promise((r) => server.once('exit', r));
  closeDatabases();
  const child = relative(resolve(tmpdir()), resolve(temporary));
  if (child.startsWith('techcare-browser-') && !child.includes('..') && !isAbsolute(child))
    await rm(temporary, { recursive: true, force: true });
}

