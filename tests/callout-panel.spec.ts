import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/demo/tokenmiser', { waitUntil: 'domcontentloaded' });
});

test('callout-panel block renders title', async ({ page }) => {
  const title = page.locator('.callout-panel .callout-panel-title');
  await expect(title).toBeVisible();
});

test('callout-panel block renders body text', async ({ page }) => {
  const body = page.locator('.callout-panel .callout-panel-body');
  await expect(body).toBeVisible();
});

test('callout-panel CTA link is present and has href', async ({ page }) => {
  const cta = page.locator('.callout-panel .callout-panel-cta');
  await expect(cta).toBeVisible();
  const href = await cta.getAttribute('href');
  expect(href).toBeTruthy();
});
