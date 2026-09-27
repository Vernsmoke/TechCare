import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const checks = [];
try {
  await page.goto('http://127.0.0.1:3002', { waitUntil: 'networkidle' });
  const launcher = page.getByRole('button', { name: 'Open guide assistant' });
  await launcher.click();
  const panel = page.getByRole('dialog', { name: 'TechCare assistant' });
  const input = panel.getByRole('textbox', { name: 'Your question' });
  const log = panel.getByRole('log');
  await expect(input).toBeFocused();
  await expect(panel.getByRole('button', { name: 'Send question' })).toBeDisabled();
  checks.push('Open, focus, and empty submission');
  const networkRequests = [];
  page.on('request', (request) => networkRequests.push(request.url()));
  async function send(text) {
    await input.fill(text);
    await input.press('Enter');
  }
  await send('My Wi-Fi has no internet');
  await expect(log.getByRole('heading', { name: 'Wi-Fi connected, no internet?' })).toBeVisible();
  await expect(log.getByRole('listitem')).toHaveCount(4);
  checks.push('Free-text question returns authored guide steps');
  await send('Wi-Fi and Windows are slow');
  await expect(log.getByRole('button', { name: 'Speed up a slow Windows PC' })).toBeVisible();
  await log.getByRole('button', { name: 'Speed up a slow Windows PC' }).click();
  await expect(log.getByRole('heading', { name: 'Speed up a slow Windows PC' })).toBeVisible();
  checks.push('Ambiguous requests offer a choice');
  await send('My laptop battery is swollen');
  await expect(log.getByText(/Stop using the device/)).toBeVisible();
  await send('What is the capital of Japan?');
  await expect(log.getByText(/I don’t have a reliable answer/)).toBeVisible();
  await send('<img src=x onerror=alert(1)>');
  await expect(log.getByText('<img src=x onerror=alert(1)>', { exact: true })).toBeVisible();
  await expect(log.locator('img')).toHaveCount(0);
  checks.push('Safety guidance, honest fallback, and escaped input');
  const appQuestions = [
    ['What is TechCare?', 'student community technology-support portal'],
    ['Can I register here?', 'display name, email, and a password of 12–128 characters'],
    ['I lost my password', 'reset a forgotten password'],
    ['My email code never arrived', 'six-digit code'],
    ['How do I send a message?', 'accepted friends'],
    ['How do friend requests work?', 'recipient must accept'],
    ['Is following the same as being friends?', 'Following and friendship are separate'],
    ['Who can see my information?', 'approved discussion contributions are public'],
    ['Can I edit my bio?', 'Save profile'],
    ['Why is my post pending?', 'reviewed before publication'],
    ['How do I ask the community?', 'submit for review'],
    ['How do I report a lost item?', 'do not expose the reporter'],
    ['Where are the videos and learning materials?', 'category filters'],
    ['How do I send feedback?', 'not an anonymous public review'],
    ['How do I report or block someone?', 'not unrestricted access'],
    ['Where is the support booth?', 'does not book appointments'],
    ['How do I sign in?', 'verified account email'],
    ['What can you help with?', 'without a ChatGPT account or paid AI service'],
    ['How do I delete my account?', 'does not have a self-service account deletion'],
  ];
  for (const [question, expected] of appQuestions) {
    await send(question);
    await expect(log.locator('.assistant-message').last()).toContainText(expected);
  }
  checks.push('19 app topics answer from public product knowledge');
  await send('How do I create an account?');
  await send('Show me the steps');
  await expect(log.locator('.assistant-message').last()).toContainText(
    'Complete email verification',
  );
  await send('How do I send a message?');
  await send('Tell me more');
  await expect(log.locator('.assistant-message').last()).toContainText(
    'Removing the friendship or blocking',
  );
  await send('That still does not work');
  await expect(log.locator('.assistant-message').last()).toContainText(
    'cannot inspect your account or device',
  );
  await panel.getByRole('button', { name: 'Clear chat' }).click();
  await send('Show me the steps');
  await expect(log.locator('.assistant-message').last()).toContainText('Which part of TechCare');
  checks.push('Follow-up steps, topic switching, support escalation, and context reset');
  const external = networkRequests.filter((url) => !url.startsWith('http://127.0.0.1:3002'));
  expect(external).toEqual([]);
  expect(
    networkRequests.some(
      (url) => /chat|assistant/.test(new URL(url).pathname) && !url.includes('_next'),
    ),
  ).toBe(false);
  checks.push('Answers require no chat endpoint or external service');
  await panel.getByRole('button', { name: 'Clear chat' }).click();
  await expect(log.locator('.assistant-message')).toHaveCount(1);
  await panel.getByRole('button', { name: 'Wi-Fi trouble', exact: true }).click();
  await send('How do I send a message?');
  await send('Show me the steps');
  await page.screenshot({ path: 'artifacts/chatbot-desktop.png' });
  const desktop = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(desktop.violations).toEqual([]);
  await input.fill('Draft stays on close');
  await input.press('Escape');
  await expect(launcher).toBeFocused();
  await launcher.click();
  await expect(input).toHaveValue('Draft stays on close');
  await expect(log.getByRole('heading', { name: 'Wi-Fi connected, no internet?' })).toBeVisible();
  checks.push('Clear, Escape, focus restoration, and close/reopen continuity');
  await panel.getByRole('button', { name: 'Ask the community' }).click();
  await expect(page.getByRole('dialog', { name: 'Welcome back' })).toBeVisible();
  await page.keyboard.press('Escape');
  await launcher.click();
  await panel.getByRole('button', { name: 'Clear chat' }).click();
  await send('Where is the support booth?');
  await log.getByRole('link', { name: 'Visit Support Booth' }).click();
  await expect(page).toHaveURL(/\/booth$/);
  await expect(launcher).toBeVisible();
  checks.push('Community sign-in handoff and working support link');
  await page.setViewportSize({ width: 390, height: 844 });
  await launcher.click();
  await panel.getByRole('button', { name: 'Clear chat' }).click();
  await panel.getByRole('button', { name: 'Laptop power', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('.sidebar').getBoundingClientRect().right <= 1,
  );
  await page.screenshot({ path: 'artifacts/chatbot-mobile.png' });
  const mobile = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(mobile.violations).toEqual([]);
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const bounds = await panel.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await expect(input).toBeVisible();
  }
  checks.push('Desktop/mobile accessibility and small/landscape viewport fit');
  await page.reload({ waitUntil: 'networkidle' });
  await launcher.click();
  await expect(log.locator('.assistant-message')).toHaveCount(1);
  checks.push('Refresh clears chat history');
  expect(errors).toEqual([]);
  const report = { checks, errors, accessibilityViolations: [] };
  await writeFile('artifacts/chatbot-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}

