import { test, expect } from '@playwright/test';

test('tokenmiser-live shows nothing when no jobs are running', async ({ page }) => {
  await page.goto('/demo/tokenmiser-dash', { waitUntil: 'domcontentloaded' });

  // Give the block time to render and fetch runs
  await page.waitForTimeout(2000);

  const inner = page.locator('.tokenmiser-live .tl-widget');
  const count = await inner.count();

  if (count > 0) {
    // A widget is present — it must be an active run (tl-busy), never an idle ghost
    await expect(inner).not.toHaveClass(/tl-idle/);
  }
  // count === 0 means empty block when idle — that's correct
});

test('tokenmiser-live does not show completed job as idle', async ({ page }) => {
  await page.goto('/demo/tokenmiser-dash', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // There must never be an idle bar that contains a job description
  const idleBar = page.locator('.tl-widget.tl-idle');
  await expect(idleBar).toHaveCount(0);
});
