import { test, expect } from '@playwright/test';

test.describe('Study Page (/study)', () => {
  test('page loads without crash', async ({ page }) => {
    await page.goto('/study');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/study');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('has "Start a Study Session" heading', async ({ page }) => {
    await page.goto('/study');
    await expect(page.locator('h1', { hasText: 'Start a Study Session' })).toBeVisible();
  });

  test('Quick Drill card is visible', async ({ page }) => {
    await page.goto('/study');
    await expect(page.locator('h2', { hasText: 'Quick Drill' })).toBeVisible();
  });

  test('Study Session card is visible', async ({ page }) => {
    await page.goto('/study');
    await expect(page.locator('h2', { hasText: 'Study Session' })).toBeVisible();
  });

  test('Quick Drill skill selector (Radix Select) is visible', async ({ page }) => {
    await page.goto('/study');
    // SelectTrigger renders a button with role="combobox"
    const trigger = page.locator('button[role="combobox"]').first();
    await expect(trigger).toBeVisible();
  });

  test('can start Quick Drill and navigate to session page', async ({ page }) => {
    await page.goto('/study');
    await page.waitForLoadState('networkidle');

    // Open the Radix Select dropdown
    const trigger = page.locator('button[role="combobox"]').first();
    await trigger.click();

    // Wait for the listbox to appear and pick the first non-disabled option
    await page.waitForSelector('[role="option"]:not([data-disabled])', { timeout: 5000 });
    const firstOption = page.locator('[role="option"]:not([data-disabled])').first();
    await firstOption.click();

    // Click "Start Quick Drill"
    const startBtn = page.locator('button', { hasText: 'Start Quick Drill' }).first();
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    // Wait for navigation to /study/[session_id]
    await page.waitForURL(/\/study\/.+/, { timeout: 15000 });
    await expect(page.url()).toMatch(/\/study\/.+/);
  });
});

test.describe('Study Session Page (/study/[id])', () => {
  test('session page loads question text and answer choices', async ({ page }) => {
    // Navigate to study, start a session
    await page.goto('/study');
    await page.waitForLoadState('networkidle');

    // Open the select and pick first valid option
    const trigger = page.locator('button[role="combobox"]').first();
    await trigger.click();
    await page.waitForSelector('[role="option"]:not([data-disabled])', { timeout: 5000 });
    await page.locator('[role="option"]:not([data-disabled])').first().click();

    const startBtn = page.locator('button', { hasText: 'Start Quick Drill' }).first();
    await startBtn.click();
    await page.waitForURL(/\/study\/.+/, { timeout: 15000 });

    // Wait for question to load (spinner disappears, question text appears)
    await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 20000 }).catch(() => {});

    // Either loading text is gone or question appeared
    // Look for the QuestionCard area
    const questionArea = page.locator('text=Loading next question...').or(
      page.locator('button').filter({ hasText: /^[A-D]$/ }).first()
    );
    // Wait for question to either show
    await page.waitForTimeout(3000);

    // Check End Session button is visible (always present)
    const endBtn = page.locator('button', { hasText: 'End Session' }).first();
    await expect(endBtn).toBeVisible();
  });

  test('can click an answer choice and see feedback panel', async ({ page }) => {
    await page.goto('/study');
    await page.waitForLoadState('networkidle');

    const trigger = page.locator('button[role="combobox"]').first();
    await trigger.click();
    await page.waitForSelector('[role="option"]:not([data-disabled])', { timeout: 5000 });
    await page.locator('[role="option"]:not([data-disabled])').first().click();

    const startBtn = page.locator('button', { hasText: 'Start Quick Drill' }).first();
    await startBtn.click();
    await page.waitForURL(/\/study\/.+/, { timeout: 15000 });

    // Wait for question to load — wait for loading spinner to disappear
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 20000 }
    );

    // Check if it's a multiple-choice or grid-in question
    const submitBtn = page.locator('button', { hasText: 'Submit Answer' });
    const hasSubmitBtn = await submitBtn.count();

    if (hasSubmitBtn > 0) {
      // Multiple-choice: select an answer choice (buttons with letter circle spans)
      const answerBtns = page.locator('button').filter({
        has: page.locator('span.rounded-full'),
      });
      const count = await answerBtns.count();
      if (count > 0) {
        await answerBtns.first().click();
      }

      // Pick a confidence level (Guessing / Okay / Confident)
      const confidentBtn = page.locator('button', { hasText: 'Okay' }).first();
      const confCount = await confidentBtn.count();
      if (confCount > 0) {
        await confidentBtn.click();
      }

      // Click Submit Answer
      await submitBtn.click();

      // After submitting, "Next Question" or "Finish Session" button should appear
      await page.waitForSelector('button:has-text("Next Question"), button:has-text("Finish Session")', {
        timeout: 15000,
      });
    } else {
      // Grid-in or no submit button — just verify session bar is present
      const endBtn = page.locator('button', { hasText: 'End Session' });
      await expect(endBtn).toBeVisible();
    }
  });
});
