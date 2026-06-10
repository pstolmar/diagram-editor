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

test('assigns a team randomly and persists in localStorage', async ({ page }) => {
  await page.goto(`${BASE}?resetTeam=1`);
  const slug = await page.evaluate(() => localStorage.getItem('ai-club:pitTeamSlug'));
  expect(slug).toBeTruthy();
  // Reload without reset — same team
  await page.goto(`http://localhost:3000/tools/ai-club-pit-crew-experience.html`);
  const slug2 = await page.evaluate(() => localStorage.getItem('ai-club:pitTeamSlug'));
  expect(slug2).toBe(slug);
});

test('resetTeam=1 clears and reassigns team', async ({ page }) => {
  await page.goto(`http://localhost:3000/tools/ai-club-pit-crew-experience.html`);
  await page.evaluate(() => localStorage.setItem('ai-club:pitTeamSlug', 'llm-dreamers'));
  await page.goto(`http://localhost:3000/tools/ai-club-pit-crew-experience.html?resetTeam=1`);
  // After reset, a team is still assigned (might be same one by chance — that's fine)
  const slug = await page.evaluate(() => localStorage.getItem('ai-club:pitTeamSlug'));
  expect(slug).toBeTruthy();
  await expect(page.locator('[data-phase="assign"]')).toHaveClass(/is-active/);
});

test('assign phase shows team name after delay', async ({ page }) => {
  await page.goto(`${BASE}?resetTeam=1`);
  await page.waitForSelector('#assign-team-name:not(:empty)', { timeout: 6000 });
  const name = await page.locator('#assign-team-name').textContent();
  expect(name?.trim().length).toBeGreaterThan(0);
});

test('assign phase renders at least 2 pawn badges', async ({ page }) => {
  await page.goto(`${BASE}?resetTeam=1`);
  await page.waitForSelector('.pawn-badge.is-visible', { timeout: 5000 });
  const count = await page.locator('.pawn-badge.is-visible').count();
  expect(count).toBeGreaterThanOrEqual(2);
});

test('countdown phase auto-advances to vote', async ({ page }) => {
  await page.goto(`${BASE}?resetTeam=1&startPhase=countdown`);
  await expect(page.locator('[data-phase="countdown"]')).toHaveClass(/is-active/);
  await page.waitForSelector('[data-phase="vote"].is-active', { timeout: 7000 });
});

test('Lock In button is disabled until all 4 groups selected', async ({ page }) => {
  await page.goto(`${BASE}?resetTeam=1&startPhase=vote`);
  const btn = page.locator('#lock-in-build');
  await expect(btn).toBeDisabled();

  const groups = ['mobility', 'utility', 'care', 'brain'];
  for (const g of groups) {
    await page.locator(`[data-group="${g}"] .option-card`).first().click();
  }
  await expect(btn).toBeEnabled();
});

test('voting advances to lobby after lock-in', async ({ page }) => {
  await page.goto(`${BASE}?resetTeam=1&startPhase=vote`);
  const groups = ['mobility', 'utility', 'care', 'brain'];
  for (const g of groups) {
    await page.locator(`[data-group="${g}"] .option-card`).first().click();
  }
  await page.locator('#lock-in-build').click();
  await expect(page.locator('[data-phase="lobby"]')).toHaveClass(/is-active/);
});
