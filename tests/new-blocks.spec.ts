// tests/new-blocks.spec.ts
import { test, expect } from '@playwright/test';

const baseUrl = 'http://localhost:3000/demo/new';

test.describe('video-panel', () => {
  test('should render video-panel block with video element', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const videoPanel = page.locator('.video-panel').first();
    await expect(videoPanel).toBeVisible();

    const videoElement = videoPanel.locator('video');
    await expect(videoElement).toBeVisible();
  });
});

test.describe('data-explorer', () => {
  test('should render data-explorer with table containing rows', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const dataExplorer = page.locator('.data-explorer');
    await expect(dataExplorer).toBeVisible();

    const tableRows = dataExplorer.locator('table tr');
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThan(0);
  });
});

test.describe('timeline-story', () => {
  test('should render timeline-story with at least 3 entries', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const timelineStory = page.locator('.timeline-story');
    await expect(timelineStory).toBeVisible();

    const entries = timelineStory.locator('.timeline-entry');
    const entryCount = await entries.count();
    expect(entryCount).toBeGreaterThanOrEqual(3);
  });
});

test.describe('poll-widget', () => {
  test('should render poll options and clickable vote button', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const pollWidget = page.locator('.poll-widget');
    await expect(pollWidget).toBeVisible();

    const options = pollWidget.locator('.poll-option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(0);

    const inputs = pollWidget.locator('input[type="radio"], input[type="checkbox"]');
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThan(0);
  });
});

test.describe('scroll-reveal', () => {
  test('should render scroll-reveal with sidebar nav and multiple panels', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const scrollReveal = page.locator('.scroll-reveal');
    await expect(scrollReveal).toBeVisible();

    const sidebarNav = scrollReveal.locator('.scroll-reveal-sidebar');
    await expect(sidebarNav).toBeVisible();

    const panels = scrollReveal.locator('.scroll-reveal-panel');
    const panelCount = await panels.count();
    expect(panelCount).toBeGreaterThanOrEqual(2);
  });
});

test.describe('live-configurator', () => {
  test('should render step 1 with selectable cards', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const liveConfigurator = page.locator('.live-configurator');
    await expect(liveConfigurator).toBeVisible();

    const progressSteps = liveConfigurator.locator('.progress-step');
    const stepCount = await progressSteps.count();
    expect(stepCount).toBeGreaterThan(0);

    const cards = liveConfigurator.locator('.card-option');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
  });
});

test.describe('viz-office-map-ims', () => {
  test('should show sign-in button when not authenticated', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const vizOfficeMap = page.locator('.viz-office-map-ims, [class*="office-map"]');
    await expect(vizOfficeMap).toBeVisible();

    const signInButton = vizOfficeMap.locator('button:has-text("sign"), button:has-text("Sign"), [class*="signin"], [class*="login"]').first();
    await expect(signInButton).toBeVisible();
  });
});
