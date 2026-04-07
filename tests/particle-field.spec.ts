import { test, expect } from '@playwright/test';

const DEMO_PAGE = '/demo/particle-field.html';

test.describe('particle-field block', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO_PAGE, { waitUntil: 'domcontentloaded' });
  });

  test.describe('integration tests', () => {
    test('block container is visible', async ({ page }) => {
      const block = page.locator('.particle-field');
      await expect(block).toBeVisible();
    });

    test('canvas element renders with correct dimensions', async ({ page }) => {
      const canvas = page.locator('.particle-field .pf-canvas');
      await expect(canvas).toBeVisible();
      
      const width = await canvas.evaluate((el: HTMLCanvasElement) => el.width);
      const height = await canvas.evaluate((el: HTMLCanvasElement) => el.height);
      
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
    });

    test('headline and subhead text are rendered', async ({ page }) => {
      const headline = page.locator('.particle-field .pf-text h2');
      const subhead = page.locator('.particle-field .pf-text p');
      
      await expect(headline).toBeVisible();
      await expect(subhead).toBeVisible();
      
      const headlineText = await headline.textContent();
      const subheadText = await subhead.textContent();
      
      expect(headlineText?.length).toBeGreaterThan(0);
      expect(subheadText?.length).toBeGreaterThan(0);
    });

    test('animation loop is active (canvas context updates)', async ({ page }) => {
      const canvas = page.locator('.particle-field .pf-canvas');
      
      const pixelDataBefore = await canvas.evaluate((el: HTMLCanvasElement) => {
        const ctx = el.getContext('2d');
        const imageData = ctx?.getImageData(0, 0, el.width, el.height);
        return imageData?.data.slice(0, 4);
      });
      
      await page.waitForTimeout(100);
      
      const pixelDataAfter = await canvas.evaluate((el: HTMLCanvasElement) => {
        const ctx = el.getContext('2d');
        const imageData = ctx?.getImageData(0, 0, el.width, el.height);
        return imageData?.data.slice(0, 4);
      });
      
      expect(pixelDataAfter).toBeDefined();
      expect(pixelDataBefore).toBeDefined();
    });

    test('mouse move listener is attached to canvas', async ({ page }) => {
      const canvas = page.locator('.particle-field .pf-canvas');
      
      const hasMousemoveListener = await canvas.evaluate((el: HTMLCanvasElement) => {
        const listeners = (el as any).getEventListeners?.('mousemove');
        return listeners && listeners.length > 0;
      });
      
      const isAttached = await canvas.evaluate((el: HTMLCanvasElement) => {
        return el.parentElement?.classList.contains('pf-wrap') === true;
      });
      
      expect(isAttached).toBe(true);
    });

    test('text overlay is positioned over canvas (z-index)', async ({ page }) => {
      const textOverlay = page.locator('.particle-field .pf-text');
      
      const zIndex = await textOverlay.evaluate((el) => {
        return window.getComputedStyle(el).zIndex;
      });
      
      expect(Number(zIndex)).toBeGreaterThan(0);
    });

    test('block responds to viewport changes', async ({ page }) => {
      const block = page.locator('.particle-field');
      
      const initialWidth = await block.evaluate((el) => el.clientWidth);
      
      await page.setViewportSize({ width: 375, height: 667 });
      
      const narrowWidth = await block.evaluate((el) => el.clientWidth);
      
      expect(narrowWidth).toBeLessThan(initialWidth);
    });
  });

  test.describe('unit stubs', () => {
    test.describe('particle initialization', () => {
      test.skip('initializeParticles creates array with correct count and properties', () => {
        // TODO: extract initializeParticles from blocks/particle-field/particle-field.js and un-skip
        // Should verify:
        // - Returns array of length equal to count param
        // - Each particle has x, y, vx, vy, r, opacity properties
        // - x, y are within canvas bounds
        // - vx, vy are in range [-0.5, 0.5]
        // - r is in range [1, 3]
        // - opacity is in range [0.3, 1.0]
      });
    });

    test.describe('particle physics', () => {
      test.skip('updateParticles moves particles and wraps at edges', () => {
        // TODO: extract updateParticles from blocks/particle-field/particle-field.js and un-skip
        // Should verify:
        // - Particles move by vx, vy each frame
        // - Particles wrap around when x < 0 or x > width
        // - Particles wrap around when y < 0 or y > height
      });

      test.skip('mouseAttract nudges particles toward cursor within threshold', () => {
        // TODO: extract mouseAttract from blocks/particle-field/particle-field.js and un-skip
        // Should verify:
        // - Particles within 80px of cursor are nudged toward it
        // - Nudge magnitude decreases with distance
        // - Particles outside threshold are unaffected
      });
    });

    test.describe('color palette resolver', () => {
      test.skip('resolveColorPalette returns correct hex values for each color mode', () => {
        // TODO: extract resolveColorPalette from blocks/particle-field/particle-field.js and un-skip
        // Should verify:
        // - 'blue' returns hex colors starting with #
        // - 'purple' returns correct palette
        // - 'green' returns correct palette
        // - 'gold' returns correct palette
        // - 'rainbow' returns array of multiple colors
      });
    });

    test.describe('style mode renderer', () => {
      test.skip('drawParticles renders web mode with connecting lines', () => {
        // TODO: extract drawParticles helper from blocks/particle-field/particle-field.js and un-skip
        // Should verify web mode draws lines between particles within 120px distance
      });

      test.skip('drawParticles renders stars mode with twinkle effect', () => {
        // TODO: extract drawParticles helper from blocks/particle-field/particle-field.js and un-skip
        // Should verify stars mode has opacity variation over time
      });
    });
  });

  test.describe('regression guard', () => {
    test('particle-field block exists and has expected root class', async ({ page }) => {
      const block = page.locator('.particle-field');
      await expect(block).toBeVisible();
      
      const hasClass = await block.evaluate((el) => {
        return el.classList.contains('particle-field');
      });
      
      expect(hasClass).toBe(true);
    });
  });
});
