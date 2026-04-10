import { test, expect } from '@playwright/test';

test.describe('photo-effects block', () => {
  test('should render empty state when no asset is provided', async ({ page }) => {
    await page.goto('/drafts/pstolmar/photo-effects-empty');
    const emptyState = page.locator('.viz-empty-state');
    await expect(emptyState).toBeVisible();
  });

  test('should load and display image from DAM URL', async ({ page }) => {
    await page.goto('/drafts/pstolmar/photo-effects-demo');
    const image = page.locator('.photo-effects-image');
    await expect(image).toBeVisible();
  });

  test('should render effect buttons', async ({ page }) => {
    await page.goto('/drafts/pstolmar/photo-effects-demo');
    const bokehBtn = page.locator('button:has-text("Bokeh")');
    const blurBtn = page.locator('button:has-text("Blur")');
    const negativeBtn = page.locator('button:has-text("Negative")');

    await expect(bokehBtn).toBeVisible();
    await expect(blurBtn).toBeVisible();
    await expect(negativeBtn).toBeVisible();
  });

  test('should apply blur effect on button click', async ({ page }) => {
    await page.goto('/drafts/pstolmar/photo-effects-demo');
    const canvas = page.locator('.photo-effects-canvas');
    const blurBtn = page.locator('button:has-text("Blur")');

    await blurBtn.click();
    const style = await canvas.getAttribute('style');
    expect(style).toContain('filter');
    expect(style).toContain('blur');
  });

  test('should show upload button for logged-in users', async ({ page, context }) => {
    await context.addCookies([{
      name: 'profile',
      value: 'logged-in',
      url: 'http://localhost:3000',
    }]);

    await page.goto('/drafts/pstolmar/photo-effects-demo');
    const uploadBtn = page.locator('button:has-text("Upload to AEM")');
    await expect(uploadBtn).toBeVisible();
  });

  test('should not show upload button for logged-out users', async ({ page }) => {
    await page.goto('/drafts/pstolmar/photo-effects-demo');
    const uploadBtn = page.locator('button:has-text("Upload to AEM")');
    await expect(uploadBtn).not.toBeVisible();
  });

  test('should reset effects', async ({ page }) => {
    await page.goto('/drafts/pstolmar/photo-effects-demo');
    const blurBtn = page.locator('button:has-text("Blur")');
    const resetBtn = page.locator('button:has-text("Reset")');
    const canvas = page.locator('.photo-effects-canvas');

    await blurBtn.click();
    let style = await canvas.getAttribute('style');
    expect(style).toContain('blur');

    await resetBtn.click();
    style = await canvas.getAttribute('style');
    expect(style).not.toContain('blur');
  });
});
