import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'artifacts/home-desktop.png', fullPage: true });
const desktop = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
  .analyze();
await page.getByRole('button', { name: 'Create Account', exact: true }).click();
await page.getByRole('dialog').waitFor();
await page.waitForFunction(
  () => getComputedStyle(document.querySelector('[role=dialog]')).opacity === '1',
);
const dialog = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
await page.screenshot({ path: 'artifacts/register-dialog.png' });
await page.getByRole('button', { name: 'Close dialog' }).click();
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForFunction(
  () => document.querySelector('.sidebar').getBoundingClientRect().right <= 1,
);
await page.screenshot({ path: 'artifacts/home-mobile.png', fullPage: true });
const mobile = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
await page.getByRole('button', { name: 'Open navigation' }).click();
await page.getByRole('navigation').getByRole('link', { name: 'Troubleshooting Guides' }).click();
await page.getByRole('heading', { name: 'A little know-how goes a long way' }).waitFor();
await page.getByRole('button', { name: /Speed up a slow Windows PC/ }).click();
await page.getByRole('dialog').waitFor();
await page.keyboard.press('Escape');
const report = {
  errors,
  overflow,
  desktop: desktop.violations.map(({ id, description, nodes }) => ({
    id,
    description,
    nodes: nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
  })),
  dialog: dialog.violations,
  mobile: mobile.violations,
};
await writeFile('artifacts/browser-check.json', JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      errors,
      overflow,
      desktopViolations: report.desktop,
      dialogViolations: dialog.violations.map((v) => v.id),
      mobileViolations: mobile.violations.map((v) => v.id),
    },
    null,
    2,
  ),
);
await browser.close();
