import { test, expect } from '@playwright/test';

test.describe('photo-cubes authorable layouts', () => {
  test('renders the 9-image skyline demo as a face-grid layout', async ({ page }) => {
    await page.goto('http://localhost:3000/demo/photocube', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(2000);

    const block = page.locator('.photo-cubes').first();
    await expect(block).toBeVisible();
    await expect(block).toHaveAttribute('data-photo-cubes-layout', 'face-grid');
    await expect(block).toHaveAttribute('data-photo-cubes-image-count', '9');
    await expect(block.locator('canvas')).toBeVisible();
    await expect(page.locator('.photo-cubes-demo-caption')).toContainText('face-grid variant');
  });

  test('shows the authoring sidebar and warning for the 10-image layout demo', async ({ page }) => {
    await page.goto('http://localhost:3000/demo/photocube-authoring', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(2000);

    const sidebar = page.locator('.photo-cubes-demo-sidebar').first();
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator('.photo-cubes-demo-field')).toHaveCount(10);

    const block = page.locator('.photo-cubes').first();
    await expect(block).toBeVisible();
    await expect(block).toHaveAttribute('data-photo-cubes-layout', 'sticker');
    await expect(block.locator('.photo-cubes-notice')).toContainText('54-slot layout');
  });
});
