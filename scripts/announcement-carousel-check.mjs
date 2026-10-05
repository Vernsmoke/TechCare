import { consentStorage } from './consent-fixture.mjs';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

// Browser-only fixtures: never publish announcements or modify the preview database.
const fixtures = [
  { title: 'Campus support day', description: 'Bring your questions to the campus support booth.' },
  {
    title: 'New troubleshooting guides',
    description:
      'Find safe steps for common Wi-Fi and laptop problems. Read a guide, then ask the community if you need more help.',
  },
  { title: 'Community update', description: 'Share what you learned with the TechCare community.' },
].map((item, index) => ({
  ...item,
  id: index + 1,
  image: '/static/campus/campus-building.webp',
  alt: 'Campus building',
  date: '',
  link: '',
}));
let items = fixtures;
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({
    storageState: consentStorage('http://127.0.0.1:3000'),
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/announcements', (route) =>
    route.fulfill({ json: { announcements: items } }),
  );
  await page.clock.install();
  const stack = page.locator('.announcement-stack');
  const active = page.locator('.announcement-slide.is-active h3');
  const advance = () => page.clock.fastForward(7100);
  const leave = async () => {
    await page.locator('.theme-toggle').focus();
    await page.mouse.move(0, 0);
  };
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
  await expect(stack).toHaveAttribute('aria-live', 'off');
  const initialHeight = (await stack.boundingBox()).height;
  await advance();
  await expect(active).toHaveText(fixtures[1].title);
  await advance();
  await expect(active).toHaveText(fixtures[2].title);
  await advance();
  await expect(active).toHaveText(fixtures[0].title);
  expect((await stack.boundingBox()).height).toBeCloseTo(initialHeight, 0);
  await expect(page.locator('.announcement-slide[inert]')).toHaveCount(2);
  console.log('PASS automatic rotation, wraparound, stable height, and inactive slides');

  await page.locator('.announcements-heading h2').hover();
  await expect(stack).toHaveAttribute('aria-live', 'polite');
  await advance();
  await expect(active).toHaveText(fixtures[0].title);
  await page.mouse.move(0, 0);
  await page.getByRole('button', { name: 'Next announcement', exact: true }).focus();
  await advance();
  await expect(active).toHaveText(fixtures[0].title);
  await page.keyboard.press('Enter');
  await expect(active).toHaveText(fixtures[1].title);
  console.log('PASS hover and keyboard pause, manual navigation');

  await page.getByRole('button', { name: 'Pause automatic announcements' }).click();
  await leave();
  await advance();
  await expect(active).toHaveText(fixtures[1].title);
  await page.getByRole('button', { name: 'Start automatic announcements' }).click();
  await leave();
  await expect(stack).toHaveAttribute('aria-live', 'off');
  await advance();
  await expect(active).toHaveText(fixtures[2].title);
  await page.getByRole('button', { name: `Enlarge image: ${fixtures[2].title}` }).click();
  await advance();
  await expect(page.getByRole('dialog')).toContainText(fixtures[2].title);
  await expect(active).toHaveText(fixtures[2].title);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await leave();
  console.log('PASS explicit pause/resume and enlarged-image pause');

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(stack).toHaveAttribute('aria-live', 'polite');
  await advance();
  await expect(active).toHaveText(fixtures[2].title);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
  });
  await expect(stack).toHaveAttribute('aria-live', 'polite');
  await advance();
  await expect(active).toHaveText(fixtures[2].title);
  await page.locator('.announcements').scrollIntoViewIfNeeded();
  await expect(stack).toHaveAttribute('aria-live', 'off');
  console.log('PASS hidden-tab and offscreen pause');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'Start automatic announcements' })).toBeVisible();
  await advance();
  await expect(active).toHaveText(fixtures[2].title);
  await page.getByRole('button', { name: 'Previous announcement', exact: true }).click();
  await expect(active).toHaveText(fixtures[1].title);
  expect(
    await page
      .locator('.announcement-slide.is-active')
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe('0s');
  console.log('PASS reduced-motion preference and manual controls');

  for (const theme of ['light', 'dark']) {
    await context.addCookies([
      { name: 'techcare-theme', value: theme, url: 'http://127.0.0.1:3000' },
    ]);
    await page.reload({ waitUntil: 'networkidle' });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator('.announcements').scrollIntoViewIfNeeded();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      await page
        .locator('.announcements')
        .screenshot({ path: `artifacts/carousel-${theme}-${width}.png` });
    }
    const audit = await new AxeBuilder({ page })
      .include('.announcements')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(audit.violations.map((violation) => violation.id)).toEqual([]);
  }
  items = fixtures.slice(0, 1);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(active).toHaveText(fixtures[0].title);
  await expect(page.locator('.announcement-controls')).toHaveCount(0);
  await advance();
  await expect(active).toHaveText(fixtures[0].title);
  items = [];
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByText('No announcements right now.')).toBeVisible();
  await expect(page.locator('.announcement-controls')).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log('PASS both themes, phone layouts, accessibility, single and empty states');
} finally {
  await browser.close();
}
