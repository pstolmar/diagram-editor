import { test, expect } from '@playwright/test';

describe('Three.js blocks', () => {
  test('wave-terrain contains canvas element', async ({ page }) => {
    await page.goto('http://localhost:3000/demo/premium-blocks', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const canvas = page.locator('.wave-terrain canvas');
    await expect(canvas).toBeVisible();
  });

  test('orbit-ring contains canvas element', async ({ page }) => {
    await page.goto('http://localhost:3000/demo/premium-blocks', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const canvas = page.locator('.orbit-ring canvas');
    await expect(canvas).toBeVisible();
  });

  test('photo-cubes contains canvas element and has data-cubelets attribute', async ({ page }) => {
    await page.goto('http://localhost:3000/demo/premium-blocks', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const photoCubes = page.locator('.photo-cubes');
    await expect(photoCubes).toHaveAttribute('data-cubelets', '27');
    const canvas = photoCubes.locator('canvas');
    await expect(canvas).toBeVisible();
  });
});
