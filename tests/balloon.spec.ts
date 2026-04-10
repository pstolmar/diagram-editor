import { test, expect } from '@playwright/test';

test.describe('Balloon block', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/demo/balloon', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
  });

  test('balloon widget is injected into body', async ({ page }) => {
    const widget = page.locator('.balloon-widget');
    await expect(widget).toBeAttached();
  });

  test('balloon SVG has ellipse body with Adobe red fill', async ({ page }) => {
    const ellipse = page.locator('.balloon-widget ellipse').first();
    await expect(ellipse).toBeVisible();
    const fill = await ellipse.getAttribute('fill');
    expect(fill?.toLowerCase()).toBe('#eb1000');
  });

  test('balloon has string path element', async ({ page }) => {
    const stringPath = page.locator('.balloon-widget .b-string');
    await expect(stringPath).toBeAttached();
  });

  test('balloon container is fixed (sticky default)', async ({ page }) => {
    const widget = page.locator('.balloon-widget');
    const pos = await widget.evaluate((el) => window.getComputedStyle(el).position);
    expect(pos).toBe('fixed');
  });

  test('balloon pops on double-click and new balloon respawns', async ({ page }) => {
    const widget = page.locator('.balloon-widget');
    const svg = widget.locator('svg').first();
    await svg.dblclick({ delay: 100 });
    // Wait for pop + respawn (650ms pop + 850ms float-up)
    await page.waitForTimeout(1600);
    const newSvg = widget.locator('svg').first();
    await expect(newSvg).toBeVisible();
  });
});
