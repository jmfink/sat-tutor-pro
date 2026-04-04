import { test, expect } from '@playwright/test';

test.describe('Review Queue (/review)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/review');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );
  });

  test('page loads without crash', async ({ page }) => {
    await expect(page).toHaveURL('/review');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('has "Review Queue" heading', async ({ page }) => {
    await expect(page.locator('h1', { hasText: 'Review Queue' })).toBeVisible();
  });

  test('shows a card count or empty state message', async ({ page }) => {
    // Either shows "{N} cards due" or "Queue is empty"
    const dueText = page.locator('text=cards due').or(page.locator('text=card due')).or(page.locator('text=Queue is empty'));
    await expect(dueText.first()).toBeVisible({ timeout: 10000 });
  });

  test('spaced repetition explanation is visible', async ({ page }) => {
    const info = page.locator('text=How it works');
    await expect(info).toBeVisible();
  });

  test('if cards are due: Start Review Session button is visible', async ({ page }) => {
    // The banner always renders "{N} cards due" — check the numeric value, not just
    // the presence of the text (since "0 cards due" would match text=cards due).
    const bannerEl = page.locator('text=cards due').or(page.locator('text=card due')).first();
    const bannerText = await bannerEl.textContent() ?? '';
    const dueCount = parseInt(bannerText, 10);

    if (dueCount > 0) {
      const startBtn = page.locator('button', { hasText: 'Start Review Session' });
      await expect(startBtn).toBeVisible();
    } else {
      // Queue empty — just verify the empty state
      await expect(page.locator('text=Queue is empty')).toBeVisible();
    }
  });

  test('if cards are due: can start review, see question and answer, then next card or finish', async ({ page }) => {
    // The banner always renders "{N} cards due" — check the numeric value, not just
    // the presence of the text (since "0 cards due" would match text=cards due).
    const bannerEl = page.locator('text=cards due').or(page.locator('text=card due')).first();
    const bannerText = await bannerEl.textContent() ?? '';
    const dueCount = parseInt(bannerText, 10);

    if (dueCount === 0) {
      test.skip(true, 'No cards due — seeded review history required for this test');
      return;
    }

    // Start review
    await page.locator('button', { hasText: 'Start Review Session' }).click();

    // Wait for question to load
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );

    // Question card should be visible
    const questionCard = page.locator('.bg-white.rounded-xl').filter({ hasText: /[A-Z]/ }).first();
    await expect(questionCard).toBeVisible({ timeout: 10000 });

    // Click first answer choice
    const answerBtns = page.locator('button').filter({
      has: page.locator('span.rounded-full'),
    });
    const answerCount = await answerBtns.count();

    if (answerCount > 0) {
      await answerBtns.first().click();

      // Feedback appears (Correct! or Incorrect)
      const feedback = page.locator('text=Correct!').or(page.locator('text=Incorrect'));
      await expect(feedback.first()).toBeVisible({ timeout: 5000 });

      // Next Card or Finish Review button appears
      const nextBtn = page.locator('button', { hasText: 'Next Card' }).or(
        page.locator('button', { hasText: 'Finish Review' })
      );
      await expect(nextBtn.first()).toBeVisible({ timeout: 5000 });

      // Click it
      await nextBtn.first().click();

      // Either we see the next question or the Review Complete screen
      await page.waitForTimeout(1000);
      const isDone = await page.locator('text=Review Complete!').count();
      const hasNextQuestion = await page.locator('.bg-white.rounded-xl').count();

      expect(isDone + hasNextQuestion).toBeGreaterThan(0);
    }
  });
});
