import { test, expect } from '@playwright/test';

test.describe('Image and Video Blocks', () => {
  const baseUrl = 'http://localhost:3000/demo/new';

  test('video-scrub: block exists and contains video element', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    
    await expect(page.locator('.video-scrub')).toBeVisible();
    const videoCount = await page.locator('.video-scrub video').count();
    expect(videoCount).toBeGreaterThan(0);
  });

  test('image-table: block exists with rows', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    
    await expect(page.locator('.image-table')).toBeVisible();
    
    const rowCount = await page.locator('.image-table table tr').count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('photo-effects: block exists with image and upload button visibility', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    
    await expect(page.locator('.photo-effects')).toBeVisible();
    
    const imgCount = await page.locator('.photo-effects img').count();
    expect(imgCount).toBeGreaterThan(0);
    
    const hasAuth = await page.evaluate(() => {
      return sessionStorage.getItem('aem_auth') !== null;
    });
    
    const uploadBtn = page.locator('.photo-effects .aem-upload-btn');
    if (hasAuth) {
      await expect(uploadBtn).toBeVisible();
    } else {
      await expect(uploadBtn).not.toBeVisible();
    }
  });
});
