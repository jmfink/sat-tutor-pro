import { test, expect } from '@playwright/test';

test.describe('Practice Test List (/practice-test)', () => {
  test('page loads without crash', async ({ page }) => {
    await page.goto('/practice-test');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/practice-test');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('has "Practice Tests" heading', async ({ page }) => {
    await page.goto('/practice-test');
    await expect(page.locator('h1', { hasText: 'Practice Tests' })).toBeVisible();
  });

  test('shows test listing content or empty state', async ({ page }) => {
    await page.goto('/practice-test');
    await page.waitForLoadState('networkidle');

    // Either test cards or the no-tests message
    const hasTests = await page.locator('button', { hasText: 'Start Test' }).count();
    const noTestsMsg = page.locator('text=No practice tests found');

    if (hasTests > 0) {
      await expect(page.locator('button', { hasText: 'Start Test' }).first()).toBeVisible();
    } else {
      await expect(noTestsMsg).toBeVisible();
    }
  });

  test('info banner is visible', async ({ page }) => {
    await page.goto('/practice-test');
    await expect(page.locator('text=What to expect')).toBeVisible();
  });
});

test.describe('Practice Test Active Page (/practice-test/[id])', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to practice-test list and start a test if one exists
    await page.goto('/practice-test');
    await page.waitForLoadState('networkidle');
  });

  test('clicking a test navigates to the test page', async ({ page }) => {
    const startBtn = page.locator('button', { hasText: 'Start Test' }).first();
    const hasTests = await startBtn.count();

    if (hasTests === 0) {
      test.skip();
      return;
    }

    await startBtn.click();
    await page.waitForURL(/\/practice-test\/.+/, { timeout: 10000 });
    await expect(page.url()).toMatch(/\/practice-test\/.+/);
  });

  test('module label visible in top bar', async ({ page }) => {
    const startBtn = page.locator('button', { hasText: 'Start Test' }).first();
    if ((await startBtn.count()) === 0) { test.skip(); return; }

    await startBtn.click();
    await page.waitForURL(/\/practice-test\/.+/, { timeout: 10000 });

    // The top bar shows current module label: "Reading & Writing — Module 1"
    const moduleLabel = page.locator('text=Reading & Writing').first();
    await expect(moduleLabel).toBeVisible({ timeout: 10000 });
  });

  test('timer element visible in top bar', async ({ page }) => {
    const startBtn = page.locator('button', { hasText: 'Start Test' }).first();
    if ((await startBtn.count()) === 0) { test.skip(); return; }

    await startBtn.click();
    await page.waitForURL(/\/practice-test\/.+/, { timeout: 10000 });

    // TimerWithBar renders a countdown — look for mm:ss pattern or the timer container
    const timer = page.locator('[class*="tabular-nums"], [class*="font-mono"]').first();
    await expect(timer).toBeVisible({ timeout: 10000 });
  });

  test('question grid visible in sidebar after questions load', async ({ page }) => {
    const startBtn = page.locator('button', { hasText: 'Start Test' }).first();
    if ((await startBtn.count()) === 0) { test.skip(); return; }

    await startBtn.click();
    await page.waitForURL(/\/practice-test\/.+/, { timeout: 10000 });

    // Wait for loading spinner to disappear (questions take ~10s to load)
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 30000 }
    );

    // Question grid renders buttons with question numbers
    const gridBtn = page.locator('.grid button').first();
    await expect(gridBtn).toBeVisible({ timeout: 10000 });
  });

  test('at least one question renders with text', async ({ page }) => {
    const startBtn = page.locator('button', { hasText: 'Start Test' }).first();
    if ((await startBtn.count()) === 0) { test.skip(); return; }

    await startBtn.click();
    await page.waitForURL(/\/practice-test\/.+/, { timeout: 10000 });

    // Wait for loading to complete
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 30000 }
    );

    // Question text is in a div with specific styling
    const questionText = page.locator('.text-base.leading-relaxed').first();
    await expect(questionText).toBeVisible({ timeout: 10000 });
  });

  test('Flag button is visible and toggles to Flagged', async ({ page }) => {
    const startBtn = page.locator('button', { hasText: 'Start Test' }).first();
    if ((await startBtn.count()) === 0) { test.skip(); return; }

    await startBtn.click();
    await page.waitForURL(/\/practice-test\/.+/, { timeout: 10000 });

    // Wait for questions to load
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 30000 }
    );

    // Flag button
    const flagBtn = page.locator('button', { hasText: 'Flag' }).first();
    await expect(flagBtn).toBeVisible({ timeout: 10000 });

    await flagBtn.click();

    // After click, button text changes to "Flagged"
    await expect(page.locator('button', { hasText: 'Flagged' }).first()).toBeVisible({ timeout: 5000 });
  });

  test('Submit Module button is visible in sidebar', async ({ page }) => {
    const startBtn = page.locator('button', { hasText: 'Start Test' }).first();
    if ((await startBtn.count()) === 0) { test.skip(); return; }

    await startBtn.click();
    await page.waitForURL(/\/practice-test\/.+/, { timeout: 10000 });

    // Submit Module button in sidebar
    const submitBtn = page.locator('button', { hasText: 'Submit Module' }).first();
    await expect(submitBtn).toBeVisible({ timeout: 15000 });
  });
});
