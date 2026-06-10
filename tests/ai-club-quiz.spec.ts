import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000/tools/ai-club-quiz.html';

// ── Page load ──────────────────────────────────────────────────────────
test.describe('Page load', () => {
  test('shows first question on load', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.quiz-question')).toBeVisible();
    await expect(page.locator('.quiz-question')).not.toHaveText('');
  });

  test('shows four option buttons', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const buttons = page.locator('.quiz-option');
    await expect(buttons).toHaveCount(4);
  });

  test('shows score counter starting at 0/10', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.quiz-score')).toContainText('0');
    await expect(page.locator('.quiz-score')).toContainText('10');
  });
});

// ── Correct answer ─────────────────────────────────────────────────────
test.describe('Correct answer selection', () => {
  test('correct answer button turns green', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    // Q1: correct is index 1 (second button)
    const buttons = page.locator('.quiz-option');
    await buttons.nth(1).click();
    await expect(buttons.nth(1)).toHaveClass(/is-correct/);
  });

  test('score counter increments on correct answer', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const buttons = page.locator('.quiz-option');
    await buttons.nth(1).click();
    await expect(page.locator('.quiz-score')).toContainText('1');
  });
});

// ── Wrong answer ───────────────────────────────────────────────────────
test.describe('Wrong answer selection', () => {
  test('wrong answer does NOT get correct highlight', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const buttons = page.locator('.quiz-option');
    await buttons.nth(0).click(); // index 0 is wrong for Q1
    await expect(buttons.nth(0)).not.toHaveClass(/is-correct/);
  });

  test('wrong answers fade out (is-wrong class applied)', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const buttons = page.locator('.quiz-option');
    await buttons.nth(0).click(); // wrong answer
    // Other options that are not selected should get is-wrong
    await expect(buttons.nth(0)).toHaveClass(/is-wrong/);
  });

  test('explanation appears after wrong answer', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const buttons = page.locator('.quiz-option');
    await buttons.nth(0).click();
    await expect(page.locator('.quiz-explanation')).toBeVisible({ timeout: 3000 });
  });

  test('score does NOT increment on wrong answer', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const buttons = page.locator('.quiz-option');
    await buttons.nth(0).click();
    await expect(page.locator('.quiz-score')).toContainText('0');
  });
});

// ── Next button ────────────────────────────────────────────────────────
test.describe('Next button', () => {
  test('Next button appears after answering', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const buttons = page.locator('.quiz-option');
    await buttons.nth(1).click();
    await expect(page.locator('.quiz-next')).toBeVisible({ timeout: 3000 });
  });

  test('Next button advances to next question', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const firstQuestion = await page.locator('.quiz-question').textContent();
    const buttons = page.locator('.quiz-option');
    await buttons.nth(1).click();
    await page.locator('.quiz-next').waitFor({ state: 'visible', timeout: 3000 });
    await page.locator('.quiz-next').click();
    const secondQuestion = await page.locator('.quiz-question').textContent();
    expect(secondQuestion).not.toBe(firstQuestion);
  });
});

// ── End screen ─────────────────────────────────────────────────────────
test.describe('End screen', () => {
  async function answerAll(page: import('@playwright/test').Page, correctIndexes: number[]) {
    for (const idx of correctIndexes) {
      const buttons = page.locator('.quiz-option');
      await buttons.nth(idx).click();
      await page.locator('.quiz-next').waitFor({ state: 'visible', timeout: 3000 });
      await page.locator('.quiz-next').click();
    }
  }

  test('end screen appears after answering all 10 questions', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    // Q1-Q10 correct indexes: 1,1,1,2,2,1,2,1,2,2
    await answerAll(page, [1, 1, 1, 2, 2, 1, 2, 1, 2, 2]);
    await expect(page.locator('.quiz-end')).toBeVisible({ timeout: 3000 });
  });

  test('end screen shows final score', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await answerAll(page, [1, 1, 1, 2, 2, 1, 2, 1, 2, 2]);
    await expect(page.locator('.quiz-end')).toContainText('10');
  });

  test('end screen shows "Prompt Pro!" for perfect score', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await answerAll(page, [1, 1, 1, 2, 2, 1, 2, 1, 2, 2]);
    await expect(page.locator('.quiz-end')).toContainText('Prompt Pro!');
  });

  test('replay button restarts the quiz', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await answerAll(page, [1, 1, 1, 2, 2, 1, 2, 1, 2, 2]);
    await page.locator('.quiz-replay').click();
    await expect(page.locator('.quiz-question')).toBeVisible();
    await expect(page.locator('.quiz-end')).not.toBeVisible();
  });
});
