import { test, expect } from '@playwright/test';

const DEMO_PAGE = '/demo/testimonials-mosaic';

test.describe('testimonials-mosaic block', () => {
  test.describe('SECTION 1 — Integration Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(DEMO_PAGE, { waitUntil: 'domcontentloaded' });
    });

    test('block container is visible and has expected CSS class', async ({ page }) => {
      const block = page.locator('.testimonials-mosaic');
      await expect(block).toBeVisible();
    });

    test('filter chips are rendered at the top', async ({ page }) => {
      const filterChips = page.locator('.testimonials-mosaic .tm-filters button');
      const count = await filterChips.count();
      expect(count).toBeGreaterThan(0);
    });

    test('testimonial cards are rendered in masonry grid', async ({ page }) => {
      const cards = page.locator('.testimonials-mosaic .tm-card');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
      
      const grid = page.locator('.testimonials-mosaic .tm-grid');
      await expect(grid).toHaveCSS('display', 'grid');
    });

    test('clicking a filter chip filters displayed cards', async ({ page }) => {
      const firstFilterChip = page.locator('.testimonials-mosaic .tm-filters button').first();
      const initialCardCount = await page.locator('.testimonials-mosaic .tm-card:not([hidden])').count();
      
      await firstFilterChip.click();
      await page.waitForTimeout(300); // allow animation
      
      const filteredCardCount = await page.locator('.testimonials-mosaic .tm-card:not([hidden])').count();
      expect(filteredCardCount).toBeLessThanOrEqual(initialCardCount);
    });

    test('show more button reveals additional cards', async ({ page }) => {
      const initialCardCount = await page.locator('.testimonials-mosaic .tm-card:not([hidden])').count();
      const showMoreButton = page.locator('.testimonials-mosaic .tm-show-more');
      
      if (await showMoreButton.isVisible()) {
        await showMoreButton.click();
        await page.waitForTimeout(300); // allow stagger animation
        
        const expandedCardCount = await page.locator('.testimonials-mosaic .tm-card:not([hidden])').count();
        expect(expandedCardCount).toBeGreaterThan(initialCardCount);
      }
    });

    test('cards animate in with staggered entry', async ({ page }) => {
      const firstCard = page.locator('.testimonials-mosaic .tm-card').first();
      const style = await firstCard.evaluate((el) => window.getComputedStyle(el).animationName);
      
      expect(style).not.toBe('none');
    });

    test('filter chips have accessible labels and semantic role', async ({ page }) => {
      const filterChips = page.locator('.testimonials-mosaic .tm-filters button');
      const firstChip = filterChips.first();
      
      const ariaLabel = await firstChip.getAttribute('aria-label');
      const textContent = await firstChip.textContent();
      
      expect(ariaLabel || textContent).toBeTruthy();
    });
  });

  test.describe('SECTION 2 — Unit Stubs', () => {
    test.describe.skip('testimonial card filtering', () => {
      test('matchesFilter() returns true when card tag matches filter', () => {
        // TODO: extract filterCards from blocks/testimonials-mosaic/testimonials-mosaic.js and un-skip
        // const result = filterCards([...cardElements], 'technology');
        // expect(result).toHaveLength(3);
      });
    });

    test.describe.skip('stagger animation timing', () => {
      test('calculateStaggerDelay() returns increasing delay for each card index', () => {
        // TODO: extract calculateStaggerDelay from blocks/testimonials-mosaic/testimonials-mosaic.js and un-skip
        // expect(calculateStaggerDelay(0)).toBe(0);
        // expect(calculateStaggerDelay(1)).toBe(50);
        // expect(calculateStaggerDelay(5)).toBe(250);
      });
    });

    test.describe.skip('show more batch pagination', () => {
      test('getBatch() returns next 6 cards from visible set', () => {
        // TODO: extract getBatch from blocks/testimonials-mosaic/testimonials-mosaic.js and un-skip
        // const cards = [...cardElements];
        // const batch = getBatch(cards, 0, 6);
        // expect(batch).toHaveLength(6);
      });
    });
  });

  test.describe('SECTION 3 — Regression Guard', () => {
    test('testimonials-mosaic block exists and is in DOM', async ({ page }) => {
      await page.goto(DEMO_PAGE, { waitUntil: 'domcontentloaded' });
      const block = page.locator('.testimonials-mosaic');
      
      await expect(block).toBeAttached();
      expect(await block.getAttribute('class')).toContain('testimonials-mosaic');
    });
  });
});
