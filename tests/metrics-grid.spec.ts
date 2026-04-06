import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/demo/tokenmiser', { waitUntil: 'domcontentloaded' });
});

test('metrics-grid block renders metric items', async ({ page }) => {
  const items = page.locator('.metrics-grid .metrics-grid-item');
  await expect(items).toHaveCount(3);
});

test('metrics-grid items display value and label', async ({ page }) => {
  const first = page.locator('.metrics-grid .metrics-grid-item').first();
  await expect(first.locator('.metrics-grid-value')).toBeVisible();
  await expect(first.locator('.metrics-grid-label')).toBeVisible();
});

test('metrics-grid block title is visible', async ({ page }) => {
  const title = page.locator('.metrics-grid .metrics-grid-title');
  await expect(title).toBeVisible();
});
