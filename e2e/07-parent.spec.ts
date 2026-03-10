import { test, expect } from '@playwright/test';

test.describe('Parent Dashboard (/parent)', () => {
  test('page loads without crash and shows PIN screen', async ({ page }) => {
    await page.goto('/parent');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/parent');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('PIN entry screen is visible', async ({ page }) => {
    await page.goto('/parent');
    await page.waitForLoadState('networkidle');

    // Page shows PIN entry first
    const heading = page.locator('h1', { hasText: 'Parent Dashboard' }).first();
    await expect(heading).toBeVisible();

    const pinInput = page.locator('input[type="password"]').first();
    await expect(pinInput).toBeVisible();
  });

  test('demo PIN hint is shown', async ({ page }) => {
    await page.goto('/parent');
    await page.waitForLoadState('networkidle');
    // Shows "Demo PIN: 1234"
    await expect(page.locator('text=Demo PIN').first()).toBeVisible();
  });

  test('entering correct PIN reveals dashboard with Predicted Score', async ({ page }) => {
    await page.goto('/parent');
    await page.waitForLoadState('networkidle');

    // Enter PIN
    const pinInput = page.locator('input[type="password"]').first();
    await pinInput.fill('1234');

    const submitBtn = page.locator('button', { hasText: 'Access Dashboard' }).first();
    await submitBtn.click();

    // Wait for data to load
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );

    // Dashboard should now show the parent view
    const predictedScoreLabel = page.locator('text=Predicted Score').first();
    await expect(predictedScoreLabel).toBeVisible({ timeout: 10000 });
  });

  test('session history section visible after login', async ({ page }) => {
    await page.goto('/parent');
    await page.waitForLoadState('networkidle');

    const pinInput = page.locator('input[type="password"]').first();
    await pinInput.fill('1234');
    await page.locator('button', { hasText: 'Access Dashboard' }).first().click();

    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );

    // Session History table OR "No sessions yet" state
    const sessionSection = page.locator('text=Session History').first();
    await expect(sessionSection).toBeVisible({ timeout: 10000 });
  });

  test('incorrect PIN shows error message', async ({ page }) => {
    await page.goto('/parent');
    await page.waitForLoadState('networkidle');

    const pinInput = page.locator('input[type="password"]').first();
    await pinInput.fill('9999');

    const submitBtn = page.locator('button', { hasText: 'Access Dashboard' }).first();
    await submitBtn.click();

    // Should show error
    await expect(page.locator('text=Incorrect PIN').first()).toBeVisible({ timeout: 5000 });
  });
});
