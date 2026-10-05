import { consentStorage } from './consent-fixture.mjs';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  storageState: consentStorage('http://127.0.0.1:3000'),
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const reports = [];
const origin = 'http://127.0.0.1:3000';
async function inspect(name) {
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  const brokenImages = await page
    .locator('img')
    .evaluateAll((images) =>
      images.filter((image) => !image.complete || !image.naturalWidth).map((image) => image.src),
    );
  reports.push({
    name,
    overflow,
    brokenImages,
    violations: results.violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    })),
  });
}
try {
  await page.goto(origin);
  await inspect('Home desktop');
  await page.screenshot({ path: 'artifacts/claude-desktop.png', fullPage: true });
  await page.locator('.guide-card').filter({ hasText: 'Speed up a slow Windows PC' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await inspect('Guide dialog');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Create Account', exact: true }).click();
  await expect(page).toHaveURL(origin + '/register');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await inspect('Registration page');
  for (const route of [
    'guides',
    'resources',
    'discussion',
    'members',
    'booth',
    'lostfound',
    'feedback',
    'privacy',
  ]) {
    await page.goto(`${origin}/${route}`);
    await inspect(route);
  }
  await page.goto(origin);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await inspect('Home dark');
  await page.screenshot({ path: 'artifacts/claude-dark.png', fullPage: true });
  await page.getByRole('link', { name: 'Create Account', exact: true }).click();
  await expect(page).toHaveURL(origin + '/register');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await inspect('Registration dark');
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await inspect(`Home ${width}px`);
    if (width === 390)
      await page.screenshot({ path: 'artifacts/claude-mobile.png', fullPage: true });
  }
} finally {
  await writeFile('artifacts/design-check.json', JSON.stringify({ errors, reports }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ errors, reports }, null, 2));
if (
  errors.length ||
  reports.some(
    (report) => report.overflow || report.brokenImages.length || report.violations.length,
  )
)
  process.exitCode = 1;
