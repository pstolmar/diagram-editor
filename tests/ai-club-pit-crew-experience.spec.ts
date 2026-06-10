import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000/tools/ai-club-pit-crew-experience.html';

test('page loads and assign phase is active', async ({ page }) => {
  await page.goto(`${BASE}?resetTeam=1`);
  await expect(page.locator('[data-phase="assign"]')).toHaveClass(/is-active/);
  await expect(page.locator('[data-phase="countdown"]')).not.toHaveClass(/is-active/);
  await expect(page.locator('[data-phase="vote"]')).not.toHaveClass(/is-active/);
});

test('startPhase param jumps to vote phase', async ({ page }) => {
  await page.goto(`${BASE}?resetTeam=1&startPhase=vote`);
  await expect(page.locator('[data-phase="vote"]')).toHaveClass(/is-active/);
  await expect(page.locator('[data-phase="assign"]')).not.toHaveClass(/is-active/);
});
