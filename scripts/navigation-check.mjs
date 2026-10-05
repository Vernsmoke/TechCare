import { consentStorage } from './consent-fixture.mjs';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

// Run against an isolated development preview; only navigation is exercised.
const origin = process.env.NAVIGATION_TEST_ORIGIN || 'http://127.0.0.1:3002';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
await mkdir('artifacts/navigation', { recursive: true });
try {
  const context = await browser.newContext({
    storageState: consentStorage(origin),
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: 'networkidle' });
  const sidebar = page.locator('.sidebar');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(sidebar).toHaveClass(/compact/);
  await expect(nav.getByRole('link')).toHaveCount(8);
  const home = nav.getByRole('link', { name: 'Home', exact: true });
  await home.hover();
  await expect(page.getByRole('tooltip')).toHaveText('Home');
  await expect
    .poll(() =>
      home.locator('.nav-icon').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a),
    )
    .toBeGreaterThan(1.1);
  await home.focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/navigation/desktop-compact.png' });
  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  await expect(nav.getByText('Troubleshooting Guides')).toBeVisible();
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/navigation/desktop-expanded.png' });
  await nav.getByRole('link', { name: 'Troubleshooting Guides' }).click();
  await expect(page).toHaveURL(origin + '/guides');
  await expect(nav.getByRole('link', { name: 'Troubleshooting Guides' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await home.hover();
  await expect
    .poll(() =>
      home.locator('.nav-icon').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a),
    )
    .toBe(1);
  console.log(
    'PASS desktop collapse, persistence, navigation, tooltips, icon motion and reduced motion',
  );

  for (const width of [900, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(sidebar).toBeHidden();
    const open = page.getByRole('button', { name: 'Open navigation' });
    await open.click();
    await expect(sidebar).toBeVisible();
    await expect(nav.getByText('Troubleshooting Guides')).toBeVisible();
    await expect(page.locator('.app-body')).toHaveAttribute('inert', '');
    await page.keyboard.press('Shift+Tab');
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement.closest('.sidebar')))
      .toBe(true);
    await page.keyboard.press('Escape');
    await expect(sidebar).toBeHidden();
    await expect(open).toBeFocused();
    await open.click();
    await nav.getByRole('link', { name: 'Troubleshooting Guides' }).click();
    await expect(sidebar).toBeHidden();
    await open.click();
    await page.locator('.mobile-backdrop').click({ position: { x: width - 5, y: 300 } });
    await expect(sidebar).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.screenshot({ path: 'artifacts/navigation/mobile-open.png' });
  const mobileAudit = await new AxeBuilder({ page })
    .include('.sidebar')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(mobileAudit.violations).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.app-body')).not.toHaveAttribute('inert');
  console.log(
    'PASS mobile/tablet drawer, Escape, focus, backdrop, same-page closure, resizing and accessibility',
  );

  for (const role of ['member', 'moderator', 'admin']) {
    await page.route('**/api/me', (route) =>
      route.fulfill({
        json: {
          user: {
            id: 987654,
            name: 'Navigation Preview',
            role,
            bio: '',
            avatar: '',
            visibility: 'private',
          },
        },
      }),
    );
    await page.reload({ waitUntil: 'networkidle' });
    await expect(nav.getByRole('link', { name: 'My Dashboard' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Moderator', exact: true })).toHaveCount(
      role === 'member' ? 0 : 1,
    );
    await expect(nav.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(
      role === 'admin' ? 1 : 0,
    );
    await page.unroute('**/api/me');
  }
  await page.setViewportSize({ width: 1024, height: 600 });
  const admin = nav.getByRole('link', { name: 'Admin', exact: true });
  await admin.focus();
  await expect(admin).toBeInViewport();
  const desktopAudit = await new AxeBuilder({ page })
    .include('.sidebar')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(desktopAudit.violations).toEqual([]);
  expect(errors).toEqual([]);
  console.log(
    'PASS role-specific navigation, short-screen scrolling and accessibility; no browser errors',
  );
} finally {
  await browser.close();
}
