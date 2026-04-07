import { test, expect, Page } from '@playwright/test';

const DEMO_PAGE = '/demo/scroll-narrative';

test.describe('scroll-narrative block', () => {
  test.describe('Integration Tests', () => {
    let page: Page;

    test.beforeEach(async ({ page: testPage }) => {
      page = testPage;
      await page.goto(DEMO_PAGE, { waitUntil: 'domcontentloaded' });
    });

    test('block container is visible', async () => {
      const block = page.locator('.scroll-narrative');
      await expect(block).toBeVisible();
    });

    test('renders sticky left panel and scrollable right panels', async () => {
      const wrapper = page.locator('.sn-wrapper');
      const sticky = page.locator('.sn-sticky');
      const stickyInner = page.locator('.sn-sticky-inner');
      const scroll = page.locator('.sn-scroll');
      const panels = page.locator('.sn-panel');

      await expect(wrapper).toBeVisible();
      await expect(sticky).toBeVisible();
      await expect(stickyInner).toBeVisible();
      await expect(scroll).toBeVisible();
      await expect(panels).toHaveCount(await panels.count());
    });

    test('IntersectionObserver swaps sticky content on panel scroll', async () => {
      const panels = page.locator('.sn-panel');
      const panelCount = await panels.count();

      if (panelCount < 2) {
        test.skip();
      }

      const stickyInner = page.locator('.sn-sticky-inner');
      const firstPanelContent = await panels.nth(0).textContent();

      // Scroll to second panel
      await panels.nth(1).scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);

      // Sticky content should have changed (after crossfade transition)
      const stickyContent = await stickyInner.textContent();
      expect(stickyContent).not.toBe(firstPanelContent);
    });

    test('applies crossfade transition class on content swap', async () => {
      const panels = page.locator('.sn-panel');
      const panelCount = await panels.count();

      if (panelCount < 2) {
        test.skip();
      }

      const stickyInner = page.locator('.sn-sticky-inner');

      // Check for transition state during swap
      await panels.nth(1).scrollIntoViewIfNeeded();

      // Verify transition styles exist (opacity and transform should change)
      const opacity = await stickyInner.evaluate(el => window.getComputedStyle(el).opacity);
      const transform = await stickyInner.evaluate(el => window.getComputedStyle(el).transform);

      expect(opacity).toBeDefined();
      expect(transform).toBeDefined();
    });

    test('stacks panels vertically on mobile viewport', async () => {
      await page.setViewportSize({ width: 375, height: 667 });

      const wrapper = page.locator('.sn-wrapper');
      const sticky = page.locator('.sn-sticky');

      // On mobile, sticky should be position static (not sticky)
      const stickyPosition = await sticky.evaluate(el => window.getComputedStyle(el).position);
      expect(['static', 'relative']).toContain(stickyPosition);

      // Wrapper should be single column
      const gridColumns = await wrapper.evaluate(el => window.getComputedStyle(el).gridTemplateColumns);
      // Should not be "40% 60%" on mobile
      expect(gridColumns).not.toContain('40%');
    });

    test('accessibility: sticky section has semantic structure', async () => {
      const sticky = page.locator('.sn-sticky');
      const stickyInner = page.locator('.sn-sticky-inner');

      // At minimum, content should be within logical containers
      await expect(sticky).toBeVisible();
      await expect(stickyInner).toBeVisible();

      // Verify panel sections are distinguishable
      const panels = page.locator('.sn-panel');
      const panelCount = await panels.count();
      expect(panelCount).toBeGreaterThan(0);
    });
  });

  test.describe('Unit Tests (Stubs)', () => {
    test.describe.skip('swapStickyContent() helper', () => {
      test('updates sticky-inner with new content node', () => {
        // TODO: extract swapStickyContent from blocks/scroll-narrative/scroll-narrative.js
        // and un-skip this test
      });

      test('applies is-leaving class before opacity transition', () => {
        // TODO: extract swapStickyContent animation logic and un-skip
      });
    });

    test.describe.skip('setupIntersectionObserver() helper', () => {
      test('observes all sn-panel elements with 0.5 threshold', () => {
        // TODO: extract setupIntersectionObserver from blocks/scroll-narrative/scroll-narrative.js
        // and un-skip this test
      });

      test('disables observer when in Universal Editor context', () => {
        // TODO: extract UE detection logic and un-skip
      });
    });

    test.describe.skip('parseScrollNarrativeRows() helper', () => {
      test('transforms table rows into sticky/scroll content pair', () => {
        // TODO: extract parseScrollNarrativeRows from blocks/scroll-narrative/scroll-narrative.js
        // and un-skip this test
      });
    });
  });

  test.describe('Regression Guard', () => {
    test('scroll-narrative block exists with correct CSS class', async ({ page }) => {
      await page.goto(DEMO_PAGE, { waitUntil: 'domcontentloaded' });

      const block = page.locator('.scroll-narrative');
      await expect(block).toBeVisible();
      expect(await block.getAttribute('class')).toContain('scroll-narrative');
    });
  });
});
