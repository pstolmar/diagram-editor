import { test, expect } from '@playwright/test';

const VIDEO_SCRUB_TEST_PATH = '/test/video-scrub';
const BLOCK_SELECTOR = '.block.video-scrub, .video-scrub.block, .video-scrub';

test.describe('video-scrub block', () => {
  test('renders video from block content', async ({ page }) => {
    await page.goto(VIDEO_SCRUB_TEST_PATH, { waitUntil: 'networkidle' });

    const block = page.locator(BLOCK_SELECTOR).first();
    await expect(block).toBeVisible();

    const video = block.locator('video.video-scrub-video');
    await expect(video).toBeVisible();

    const src = await video.getAttribute('src');
    expect(src).toBeTruthy();
  });

  test('renders speed controls with active state', async ({ page }) => {
    await page.goto(VIDEO_SCRUB_TEST_PATH, { waitUntil: 'networkidle' });

    const block = page.locator(BLOCK_SELECTOR).first();
    const video = block.locator('video.video-scrub-video');
    const controls = block.locator('.video-scrub-controls');

    await expect(controls).toBeVisible();
    const buttons = controls.locator('button.video-scrub-speed');
    await expect(buttons).toHaveCount(3);

    const normalButton = controls.getByRole('button', { name: '1x' });
    await expect(normalButton).toHaveClass(/is-active/);

    const doubleButton = controls.getByRole('button', { name: '2x' });
    await doubleButton.click();

    const playbackRate = await video.evaluate((el) => el.playbackRate);
    expect(playbackRate).toBe(2);
    await expect(doubleButton).toHaveClass(/is-active/);
  });

  test('shows viz-empty-state when no video URL', async ({ page }) => {
    await page.goto(VIDEO_SCRUB_TEST_PATH, { waitUntil: 'networkidle' });

    const emptyBlock = page.locator(BLOCK_SELECTOR).nth(1);
    const emptyState = emptyBlock.locator('.viz-empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyBlock.locator('video')).toHaveCount(0);
  });

  test('falls back to empty state on video error', async ({ page }) => {
    await page.goto(VIDEO_SCRUB_TEST_PATH, { waitUntil: 'networkidle' });

    const block = page.locator(BLOCK_SELECTOR).first();
    const video = block.locator('video.video-scrub-video');

    await video.evaluate((el) => {
      el.dispatchEvent(new Event('error'));
    });

    const emptyState = block.locator('.viz-empty-state');
    await expect(emptyState).toBeVisible();
    await expect(block.locator('video')).toHaveCount(0);
  });
});
