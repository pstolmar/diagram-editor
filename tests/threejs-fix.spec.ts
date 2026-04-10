import { test, expect } from '@playwright/test';

test.describe('Premium blocks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/demo/premium-blocks', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(3000);
  });

  test('photo-cubes UV intact—canvas exists, data-cubelets=27, data-uv-mode=tiled', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    const photoCubesBlock = page.locator('[data-cubelets="27"]');

    await expect(canvas).toBeVisible();
    await expect(photoCubesBlock).toHaveAttribute('data-cubelets', '27');
    await expect(photoCubesBlock).toHaveAttribute('data-uv-mode', 'tiled');
  });

  test('photo-cubes no clip—data-rotation-ok=true after first scramble', async ({ page }) => {
    const photoCubesBlock = page.locator('[class*="photo-cubes"]').first();

    await photoCubesBlock.click();
    await page.waitForTimeout(500);

    await expect(photoCubesBlock).toHaveAttribute('data-rotation-ok', 'true');
  });

  test('wave-terrain mouse-follow—canvas exists, data-mouse-follow=true', async ({ page }) => {
    const canvas = page.locator('canvas').nth(1);
    const waveTerrainBlock = page.locator('[data-mouse-follow="true"]');

    await expect(canvas).toBeVisible();
    await expect(waveTerrainBlock).toHaveAttribute('data-mouse-follow', 'true');
  });

  test('wave-terrain responsive—canvas width > 600', async ({ page }) => {
    const canvas = page.locator('canvas').nth(1);
    const boundingBox = await canvas.boundingBox();

    expect(boundingBox?.width).toBeGreaterThan(600);
  });
});
