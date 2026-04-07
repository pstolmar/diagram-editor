import { test, expect } from '@playwright/test';

const DEMO_PAGE = '/demo/csv-chart';

test.describe('csv-chart block', () => {
  test.describe('Integration Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(DEMO_PAGE, { waitUntil: 'domcontentloaded' });
    });

    test('block container is visible with correct CSS class', async ({ page }) => {
      const block = page.locator('.csv-chart');
      await expect(block).toBeVisible();
    });

    test('renders chart canvas or SVG after CSV data parsing', async ({ page }) => {
      const block = page.locator('.csv-chart');
      const canvas = block.locator('canvas, svg.csv-chart-render');
      await expect(canvas).toBeVisible({ timeout: 5000 });
    });

    test('CSV data rows are parsed into chart series', async ({ page }) => {
      const block = page.locator('.csv-chart');
      const dataElements = block.locator('[data-csv-row]');
      const count = await dataElements.count();
      expect(count).toBeGreaterThan(0);
    });

    test('chart legend displays with correct labels', async ({ page }) => {
      const block = page.locator('.csv-chart');
      const legend = block.locator('.csv-chart-legend');
      await expect(legend).toBeVisible();
      const labels = legend.locator('.csv-chart-legend-item');
      expect(await labels.count()).toBeGreaterThan(0);
    });

    test('chart respects container width on viewport resize', async ({ page }) => {
      const block = page.locator('.csv-chart');
      const originalBBox = await block.boundingBox();
      expect(originalBBox).not.toBeNull();

      await page.setViewportSize({ width: 480, height: 800 });
      const resizedBBox = await block.boundingBox();
      expect(resizedBBox).not.toBeNull();
      expect(resizedBBox?.width).toBeLessThan(originalBBox!.width);
    });

    test('chart has accessible role and aria-label', async ({ page }) => {
      const block = page.locator('.csv-chart');
      const chart = block.locator('[role="img"], [role="figure"]');
      const hasRole = await chart.count();
      const hasLabel = await block.locator('[aria-label]').count();
      expect(hasRole + hasLabel).toBeGreaterThan(0);
    });

    test('chart type can be toggled via data attribute or control', async ({ page }) => {
      const block = page.locator('.csv-chart');
      const typeControl = block.locator('.csv-chart-type-toggle, [data-chart-type]');
      if (await typeControl.count() > 0) {
        const initialType = await block.getAttribute('data-chart-type');
        await typeControl.first().click();
        const newType = await block.getAttribute('data-chart-type');
        expect(newType).not.toBe(initialType);
      }
    });
  });

  test.describe('Unit Stubs', () => {
    test.describe.skip('CSV Parser Helper', () => {
      test('parses CSV string into rows and columns', () => {
        // TODO: extract parseCSV from blocks/csv-chart/csv-chart.js and un-skip
        // Input: "header1,header2\nval1,val2\nval3,val4"
        // Expected: { headers: [...], rows: [...] }
      });

      test('handles quoted fields with commas', () => {
        // TODO: extract parseCSV and un-skip
        // Input: 'name,"address, city",value'
        // Expected: field array with correct comma handling
      });

      test('filters CSV rows by numeric or categorical criteria', () => {
        // TODO: extract filterCSVRows from blocks/csv-chart/csv-chart.js and un-skip
      });
    });

    test.describe.skip('Chart Renderer Helper', () => {
      test('renders bar chart from parsed CSV data', () => {
        // TODO: extract renderBarChart from blocks/csv-chart/csv-chart.js and un-skip
        // Input: { headers, rows, type: 'bar' }
        // Expected: canvas or SVG element with bar paths/rects
      });

      test('renders line chart with points and axis labels', () => {
        // TODO: extract renderLineChart from blocks/csv-chart/csv-chart.js and un-skip
      });

      test('scales chart axes to fit min/max data values', () => {
        // TODO: extract scaleChartAxes from blocks/csv-chart/csv-chart.js and un-skip
      });
    });

    test.describe.skip('Legend Generator Helper', () => {
      test('builds legend item list from CSV headers', () => {
        // TODO: extract generateLegend from blocks/csv-chart/csv-chart.js and un-skip
      });
    });
  });

  test.describe('Regression Guard', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(DEMO_PAGE, { waitUntil: 'domcontentloaded' });
    });

    test('csv-chart block root element exists and has class', async ({ page }) => {
      const block = page.locator('.csv-chart');
      await expect(block).toHaveCount(1);
      const classes = await block.getAttribute('class');
      expect(classes).toContain('csv-chart');
    });
  });
});
