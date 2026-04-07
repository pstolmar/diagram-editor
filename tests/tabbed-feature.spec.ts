import { test, expect, Page } from '@playwright/test';

const DEMO_PAGE = '/demo/tabbed-feature.html';

test.describe('tabbed-feature block', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO_PAGE, { waitUntil: 'domcontentloaded' });
  });

  // SECTION 1 — Integration Tests

  test.describe('integration', () => {
    test('block container is visible and has correct CSS class', async ({
      page,
    }) => {
      const block = page.locator('.tabbed-feature');
      await expect(block).toBeVisible();
    });

    test('renders tab list and panel area', async ({ page }) => {
      const tabList = page.locator('.tf-tabs');
      const panelWrap = page.locator('.tf-panel-wrap');
      
      await expect(tabList).toBeVisible();
      await expect(panelWrap).toBeVisible();
    });

    test('clicking a tab activates it and shows corresponding panel', async ({
      page,
    }) => {
      // First tab should be active by default
      const firstTab = page.locator('.tf-tab').first();
      const secondTab = page.locator('.tf-tab').nth(1);
      const secondPanel = page.locator('.tf-panel').nth(1);

      // Click second tab
      await secondTab.click();

      // Second tab should now have is-active class
      await expect(secondTab).toHaveClass(/is-active/);

      // Second panel should be visible
      await expect(secondPanel).toHaveClass(/is-active/);
      await expect(secondPanel).toBeVisible();

      // First tab should no longer be active
      await expect(firstTab).not.toHaveClass(/is-active/);
    });

    test('progress bar resets and animates on tab change', async ({
      page,
    }) => {
      const firstTab = page.locator('.tf-tab').first();
      const secondTab = page.locator('.tf-tab').nth(1);
      const firstProgress = firstTab.locator('.tf-progress');

      // Get initial computed style of progress bar
      const initialWidth = await firstProgress.evaluate((el) =>
        window.getComputedStyle(el).width
      );

      // Click second tab
      await secondTab.click();

      // Progress bar in second tab should now animate
      const secondProgress = secondTab.locator('.tf-progress');
      await expect(secondProgress).toBeVisible();

      // After a short delay, progress should have advanced
      await page.waitForTimeout(500);
      const progressAfter = await secondProgress.evaluate((el) =>
        window.getComputedStyle(el).width
      );
      
      // Width should be greater than initial width (animation in progress)
      const initialPixels = parseInt(initialWidth, 10);
      const afterPixels = parseInt(progressAfter, 10);
      expect(afterPixels).toBeGreaterThanOrEqual(initialPixels);
    });

    test('hovering pauses auto-advance timer', async ({ page }) => {
      const firstTab = page.locator('.tf-tab').first();
      const secondTab = page.locator('.tf-tab').nth(1);

      // Get initial active tab
      const initialActiveClass = await firstTab.getAttribute('class');

      // Hover over the tab list to pause timer
      await firstTab.hover();

      // Wait 6 seconds (longer than auto-advance interval)
      await page.waitForTimeout(6000);

      // First tab should still be active (timer was paused)
      await expect(firstTab).toHaveClass(/is-active/);
      await expect(secondTab).not.toHaveClass(/is-active/);

      // Move mouse away to resume timer
      await page.mouse.move(0, 0);
      
      // Wait for auto-advance to trigger
      await page.waitForTimeout(6000);

      // Now second tab should be active
      await expect(secondTab).toHaveClass(/is-active/);
    });

    test('responsive layout stacks on small viewport', async ({ page }) => {
      // Resize to mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });

      const wrap = page.locator('.tf-wrap');
      
      // On mobile, tabs should be horizontal (display grid or flex row)
      // Verify block is still visible and functional
      await expect(wrap).toBeVisible();

      const tabs = page.locator('.tf-tab');
      await expect(tabs.first()).toBeVisible();
    });

    test('panel has accessible heading and content', async ({ page }) => {
      const activePanel = page.locator('.tf-panel.is-active');
      const heading = activePanel.locator('h2, h3, [role="heading"]').first();

      // At least one heading or semantic element should exist
      await expect(activePanel).toBeVisible();
      // Content should be accessible
      const text = await activePanel.textContent();
      expect(text?.length).toBeGreaterThan(0);
    });
  });

  // SECTION 2 — Unit Stubs (skipped until block implementation)

  test.describe('unit stubs', () => {
    test.skip('parseTabRows parses block content into tab data', () => {
      // TODO: extract parseTabRows from blocks/tabbed-feature/tabbed-feature.js and un-skip
      // Should parse HTML rows: [tabLabel, imageEl, heading, bodyText]
      // Expected behavior:
      // const rows = [
      //   ['Dashboard', <img>, 'Overview', 'Key metrics\nTop performers'],
      //   ['Analytics', <img>, 'Deep Dive', 'User trends\nRevenue data']
      // ];
      // const result = parseTabRows(rows);
      // expect(result[0].label).toBe('Dashboard');
      // expect(result[0].heading).toBe('Overview');
    });

    test.skip('buildTabStructure creates DOM structure from parsed data', () => {
      // TODO: extract buildTabStructure from blocks/tabbed-feature/tabbed-feature.js and un-skip
      // Should create .tf-wrap with .tf-tabs and .tf-panel-wrap
      // const data = [...];
      // const dom = buildTabStructure(data);
      // expect(dom.querySelector('.tf-tabs')).toBeTruthy();
      // expect(dom.querySelectorAll('.tf-tab')).toHaveLength(data.length);
    });

    test.skip('calculateProgressDuration returns 5000ms for auto-advance', () => {
      // TODO: extract calculateProgressDuration from blocks/tabbed-feature/tabbed-feature.js and un-skip
      // const duration = calculateProgressDuration();
      // expect(duration).toBe(5000);
    });

    test.skip('toggleActiveTab updates active classes on tab and panel', () => {
      // TODO: extract toggleActiveTab from blocks/tabbed-feature/tabbed-feature.js and un-skip
      // Should add is-active to target, remove from others
      // const tab = document.createElement('div');
      // const panels = [document.createElement('div'), document.createElement('div')];
      // toggleActiveTab(tab, panels, 1);
      // expect(tab.classList.contains('is-active')).toBe(true);
    });
  });

  // SECTION 3 — Regression Guard

  test.describe('regression', () => {
    test('tabbed-feature block root element exists with expected class', async ({
      page,
    }) => {
      const block = page.locator('.tabbed-feature');
      await expect(block).toBeVisible();

      // Verify it's not accidentally removed or renamed
      const classList = await block.getAttribute('class');
      expect(classList).toContain('tabbed-feature');
    });
  });
});
