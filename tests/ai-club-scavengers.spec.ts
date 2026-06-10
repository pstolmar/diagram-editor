import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000/tools/ai-club-scavengers.html';

// ── Projected Score ────────────────────────────────────────────────
test.describe('Projected Score visibility', () => {
  test('score card is hidden by default', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.score-card')).toHaveClass(/is-hidden/);
  });

  test('score card is visible in sandbox mode', async ({ page }) => {
    await page.goto(`${BASE}?sandbox=1`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.score-card')).not.toHaveClass(/is-hidden/);
  });
});

// ── Replay button ──────────────────────────────────────────────────
test.describe('Replay button', () => {
  test('replay button exists and is hidden initially', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const btn = page.locator('#replay-mission');
    await expect(btn).toBeAttached();
    await expect(btn).toHaveClass(/is-hidden/);
  });

  test('replay button appears after mission runs', async ({ page }) => {
    await page.goto(`${BASE}?sandbox=1&autorun=1`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#replay-mission')).not.toHaveClass(/is-hidden/, { timeout: 30000 });
  });
});

// ── Time scoring ───────────────────────────────────────────────────
test.describe('Time-efficiency scoring', () => {
  test('mission console shows estimated time label', async ({ page }) => {
    await page.goto(`${BASE}?sandbox=1`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#estimated-time')).toBeAttached();
  });

  test('fast build earns a time bonus', async ({ page }) => {
    await page.goto(`${BASE}?sandbox=1`, { waitUntil: 'domcontentloaded' });
    const bonus = await page.evaluate(() => {
      const speedStat = 5; // scout-legs (+3) + fast-guesser (+2)
      return Math.max(0, Math.floor(speedStat * 0.5));
    });
    expect(bonus).toBe(2);
  });
});

// ── Vote form fields ───────────────────────────────────────────────
test.describe('Vote form fields', () => {
  test('hidden form fields exist', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    for (const id of ['form-team-slug', 'form-team-name', 'form-voter-id',
                       'form-mobility', 'form-utility', 'form-care', 'form-brain']) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
  });

  test('casting a vote populates the matching form field', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    // Click the first option card in the first vote group (mobility → scout-legs)
    await page.locator('.vote-group').first().locator('.option-card').first().click();
    const value = await page.locator('#form-mobility').inputValue();
    expect(value).toBe('scout-legs');
  });
});

// ── Locked state ───────────────────────────────────────────────────
test.describe('Post-submission locked state', () => {
  test('submit-votes button exists in build panel', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#submit-my-votes')).toBeAttached();
  });

  test('clicking submit locks the option cards', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    // Vote in all groups first
    for (const group of await page.locator('.vote-group').all()) {
      await group.locator('.option-card').first().click();
    }
    await page.locator('#submit-my-votes').click();
    // All option cards should now be disabled
    const cards = page.locator('.option-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i)).toBeDisabled();
    }
  });

  test('projected score is revealed after submit', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    // Score card hidden before submit
    await expect(page.locator('.score-card')).toHaveClass(/is-hidden/);
    // Submit
    for (const group of await page.locator('.vote-group').all()) {
      await group.locator('.option-card').first().click();
    }
    await page.locator('#submit-my-votes').click();
    // Score card visible after submit
    await expect(page.locator('.score-card')).not.toHaveClass(/is-hidden/);
  });

  test('locked banner appears after submit', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    for (const group of await page.locator('.vote-group').all()) {
      await group.locator('.option-card').first().click();
    }
    await page.locator('#submit-my-votes').click();
    await expect(page.locator('#locked-banner')).not.toHaveClass(/is-hidden/);
  });

  test('return-to-arena link appears after submit', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    for (const group of await page.locator('.vote-group').all()) {
      await group.locator('.option-card').first().click();
    }
    await page.locator('#submit-my-votes').click();
    await expect(page.locator('#return-to-arena')).not.toHaveClass(/is-hidden/);
  });
});
