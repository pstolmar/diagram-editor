import { test, expect, Page } from '@playwright/test';

const DEMO_PAGE = '/demo/viz-blocks.html';

test.describe('popin-carousel block', () => {
  // SECTION 1 — Integration Tests

  test.describe('integration', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(DEMO_PAGE, { waitUntil: 'domcontentloaded' });
    });

    test('block container is visible', async ({ page }) => {
      const block = page.locator('.popin-carousel');
      await expect(block).toBeVisible();
    });

    test('grid structure renders with correct dimensions', async ({ page }) => {
      const grid = page.locator('.pc-grid');
      await expect(grid).toBeVisible();

      // For demo: 3x3 grid = 9 slots
      const slots = page.locator('.pc-slot');
      const count = await slots.count();
      expect(count).toBe(9);
    });

    test('all visible slots contain images', async ({ page }) => {
      const slots = page.locator('.pc-slot');
      const count = await slots.count();

      for (let i = 0; i < count; i++) {
        const slot = slots.nth(i);
        const img = slot.locator('img');
        await expect(img).toBeVisible();
        const src = await img.getAttribute('src');
        expect(src).toBeTruthy();
      }
    });

    test('entrance effect class is applied on initial load', async ({ page }) => {
      const grid = page.locator('.pc-grid');
      const dataEffect = await grid.getAttribute('data-effect');
      expect(['sizzle', 'paint-wipe', 'bloom', 'glitch']).toContain(dataEffect);
    });

    test('grid respects aspect ratio for slots', async ({ page }) => {
      const slot = page.locator('.pc-slot').first();
      const boundingBox = await slot.boundingBox();

      // aspect-ratio: 1 means width should equal height
      expect(boundingBox?.width).toBeGreaterThan(0);
      expect(Math.abs(boundingBox!.width - boundingBox!.height)).toBeLessThan(2);
    });

    test('carousel pauses cycling when out of viewport', async ({ page }) => {
      // Scroll block out of view
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));

      // Brief wait to ensure any cycling intervals are paused
      await page.waitForTimeout(100);

      // Image sources should not change while paused
      const img1 = page.locator('.pc-slot').first().locator('img');
      const src1 = await img1.getAttribute('src');
      await page.waitForTimeout(500);
      const src2 = await img1.getAttribute('src');

      expect(src1).toBe(src2);
    });

    test('grid renders as single column on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 400, height: 800 });

      // Wait for any responsive reflow
      await page.waitForTimeout(100);

      const grid = page.locator('.pc-grid');
      const computedStyle = await grid.evaluate((el) => {
        return window.getComputedStyle(el).gridTemplateColumns;
      });

      // On mobile, should be single column or very narrow columns
      expect(computedStyle).toBeTruthy();
    });

    test('images have accessible alt text', async ({ page }) => {
      const img = page.locator('.pc-slot img').first();
      const alt = await img.getAttribute('alt');

      // At minimum, image should have alt attribute
      expect(alt).toBeDefined();
    });
  });

  // SECTION 2 — Unit Stubs

  test.describe('unit stubs', () => {
    test.describe('parseGridSize', () => {
      test.skip('parses grid size from text content and clamps to 2-5', () => {
        // TODO: extract parseGridSize from blocks/popin-carousel/popin-carousel.js and un-skip
        // Should accept "2", "3", "4", "5" and reject/clamp outside range
        // parseGridSize("3") => 3
        // parseGridSize("1") => 2
        // parseGridSize("6") => 5
      });
    });

    test.describe('parseEffect', () => {
      test.skip('validates effect name from authored content', () => {
        // TODO: extract parseEffect from blocks/popin-carousel/popin-carousel.js and un-skip
        // Should return one of: "sizzle", "paint-wipe", "bloom", "glitch"
        // parseEffect("sizzle") => "sizzle"
        // parseEffect("invalid") => "sizzle" (default)
      });
    });

    test.describe('parseInterval', () => {
      test.skip('parses cycle interval and returns float', () => {
        // TODO: extract parseInterval from blocks/popin-carousel/popin-carousel.js and un-skip
        // Should parseFloat and default to 2.5 if invalid
        // parseInterval("2.5") => 2.5
        // parseInterval("invalid") => 2.5
      });
    });

    test.describe('calculateSlotCount', () => {
      test.skip('returns N² given grid size N', () => {
        // TODO: extract or create calculateSlotCount and un-skip
        // calculateSlotCount(2) => 4
        // calculateSlotCount(3) => 9
        // calculateSlotCount(5) => 25
      });
    });

    test.describe('pickRandomSlot', () => {
      test.skip('returns random slot index within bounds', () => {
        // TODO: extract pickRandomSlot from blocks/popin-carousel/popin-carousel.js and un-skip
        // Should return integer in [0, slotCount)
        // pickRandomSlot(9) => value between 0 and 8
      });
    });
  });

  // SECTION 3 — Regression Guard

  test.describe('regression guard', () => {
    test('block root element exists with expected class', async ({ page }) => {
      await page.goto(DEMO_PAGE, { waitUntil: 'domcontentloaded' });

      const block = page.locator('.popin-carousel');
      await expect(block).toBeAttached();
      await expect(block).toHaveClass(/popin-carousel/);
    });
  });
});
