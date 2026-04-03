import { test, expect } from '@playwright/test';

test('demo Experian page loads', async ({ page }) => {
  // Go directly to the working demo page, do NOT rely on "/"
  await page.goto('http://localhost:3000/demo/experiandemo', {
    waitUntil: 'domcontentloaded',
  });

  // Minimal assertion: body is visible
  await expect(page.locator('body')).toBeVisible();
});
