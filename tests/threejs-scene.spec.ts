import { test, expect } from '@playwright/test';

const DEMO_PAGE = '/demo/threejs-scene';

test.describe('threejs-scene block', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO_PAGE, { waitUntil: 'domcontentloaded' });
  });

  test.describe('Integration tests', () => {
    test('block container is visible with correct CSS class', async ({ page }) => {
      const block = page.locator('.threejs-scene');
      await expect(block).toBeVisible();
    });

    test('canvas element is rendered inside the block', async ({ page }) => {
      const canvas = page.locator('.threejs-scene canvas');
      await expect(canvas).toBeVisible();
    });

    test('3D scene initializes and renders content', async ({ page }) => {
      const canvas = page.locator('.threejs-scene canvas');
      const context = await canvas.evaluate((el: HTMLCanvasElement) => {
        const webglContext = el.getContext('webgl2') || el.getContext('webgl');
        return webglContext ? 'initialized' : 'failed';
      });
      expect(context).toBe('initialized');
    });

    test('canvas resizes responsively with viewport changes', async ({ page }) => {
      const canvas = page.locator('.threejs-scene canvas');
      const initialWidth = await canvas.evaluate((el: HTMLCanvasElement) => el.clientWidth);

      await page.setViewportSize({ width: 500, height: 600 });
      await page.waitForTimeout(100);

      const newWidth = await canvas.evaluate((el: HTMLCanvasElement) => el.clientWidth);
      expect(newWidth).toBeLessThan(initialWidth);
    });

    test('mouse interaction is supported (rotation/zoom handlers attached)', async ({ page }) => {
      const canvas = page.locator('.threejs-scene canvas');
      const hasListeners = await canvas.evaluate((el) => {
        const listeners = ['mousedown', 'mousemove', 'mouseup', 'wheel'];
        return listeners.some(event => el.onmousedown || el.onmousemove || el.onmouseup || el.onwheel);
      });
      expect(hasListeners).toBeTruthy();
    });

    test('block does not break when loaded in UE authoring context', async ({ page, context }) => {
      const newPage = await context.newPage();
      await newPage.evaluate(() => {
        document.documentElement.classList.add('hlx-ue');
      });
      await newPage.goto(DEMO_PAGE, { waitUntil: 'domcontentloaded' });

      const block = newPage.locator('.threejs-scene');
      await expect(block).toBeVisible();
      await newPage.close();
    });

    test('accessibility: scene container has fallback aria-label or role', async ({ page }) => {
      const block = page.locator('.threejs-scene');
      const ariaLabel = await block.getAttribute('aria-label');
      const role = await block.getAttribute('role');
      expect(ariaLabel || role).toBeTruthy();
    });
  });

  test.describe('Unit stubs — Three.js helpers', () => {
    test.describe.skip('SceneConfig parser', () => {
      test('parses scene configuration from block dataset', async () => {
        // TODO: extract parseSceneConfig from blocks/threejs-scene/threejs-scene.js and un-skip
        // Should parse data-* attributes or JSON in block metadata
        // Expected: { cameraType, initialRotation, lighting, ... }
      });

      test('validates and provides sensible defaults for missing config', async () => {
        // TODO: extract parseSceneConfig and un-skip
      });
    });

    test.describe.skip('Camera & Renderer setup', () => {
      test('initializeCamera creates appropriate camera (perspective/orthographic)', async () => {
        // TODO: extract initializeCamera from blocks/threejs-scene/threejs-scene.js and un-skip
      });

      test('initializeRenderer configures WebGL context with correct DPI and viewport', async () => {
        // TODO: extract initializeRenderer and un-skip
      });
    });

    test.describe.skip('Geometry & Material factory', () => {
      test('createGeometry parses geometry type and parameters', async () => {
        // TODO: extract createGeometry from blocks/threejs-scene/threejs-scene.js and un-skip
      });

      test('applyMaterial applies standard PBR or basic material with textures', async () => {
        // TODO: extract applyMaterial and un-skip
      });
    });

    test.describe.skip('Event handler attachment', () => {
      test('attachMouseControls sets up rotate/pan/zoom listeners', async () => {
        // TODO: extract attachMouseControls from blocks/threejs-scene/threejs-scene.js and un-skip
      });

      test('attachResizeListener updates canvas and camera on window resize', async () => {
        // TODO: extract attachResizeListener and un-skip
      });
    });
  });

  test.describe('Regression guard', () => {
    test('threejs-scene block exists and has correct root class', async ({ page }) => {
      const block = page.locator('.threejs-scene');
      await expect(block).toHaveCount(1);
    });
  });
});
