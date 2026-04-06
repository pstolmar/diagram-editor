import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/demo/tokenmiser', { waitUntil: 'domcontentloaded' });
});

test('image-compare block renders slider handle', async ({ page }) => {
  const slider = page.locator('.image-compare .image-compare-slider');
  await expect(slider).toBeVisible();
});

test('image-compare slider has ARIA label', async ({ page }) => {
  const slider = page.locator('.image-compare .image-compare-slider');
  await expect(slider).toHaveAttribute('aria-label');
});

test('image-compare before and after images are present', async ({ page }) => {
  const block = page.locator('.image-compare');
  await expect(block.locator('.image-compare-before')).toBeVisible();
  await expect(block.locator('.image-compare-after')).toBeVisible();
});

test('image-compare slider position updates on drag', async ({ page }) => {
  const handle = page.locator('.image-compare .image-compare-handle');
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  if (!box) throw new Error('handle not found');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 50, box.y + box.height / 2);
  await page.mouse.up();
  const sliderStyle = await page.locator('.image-compare-after').getAttribute('style');
  expect(sliderStyle).toBeTruthy();
});
