import { test, expect } from '@playwright/test';

test.describe('Dashboard (/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('page loads without crash', async ({ page }) => {
    await expect(page).toHaveURL('/');
    // No error boundary or crash text
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('contains greeting heading', async ({ page }) => {
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
  });

  test('greeting shows student name from database, not fallback "Student"', async ({ page }) => {
    // The test account is created with name "Test Student" in global-setup.
    // If the name is loaded correctly from the students table, the greeting will
    // contain "Test Student". If it falls back, it shows just "Student" alone.
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    // Should contain the DB name, not the bare fallback
    await expect(heading).toContainText('Test Student', { timeout: 10000 });
  });

  test('Predicted Score widget is visible', async ({ page }) => {
    // The score widget always renders — either with a score or the unlock message
    const scoreWidget = page.locator('text=Predicted Score').first();
    await expect(scoreWidget).toBeVisible();
  });

  test('Study Streak section is visible', async ({ page }) => {
    // Dashboard redesign: streak is shown inline with "day streak" label, no section heading
    const streakLabel = page.locator('text=day streak').first();
    await expect(streakLabel).toBeVisible();
  });

  test('Quick Actions section is visible', async ({ page }) => {
    // Dashboard redesign: "Quick Actions" heading removed; action tiles are shown directly.
    // Verify one of the canonical secondary action tiles is present.
    const practiceTestTile = page.locator('text=Practice Test').first();
    await expect(practiceTestTile).toBeVisible();
  });

  test('Recent Sessions section is visible', async ({ page }) => {
    // Dashboard redesign: "Recent Sessions" section was removed from the dashboard.
    // Weekly stats (questions count, accuracy) are shown inline in the streak widget.
    test.skip(true, 'Recent Sessions section removed from dashboard in redesign — stats shown inline in streak widget');
  });

  test('Review Queue card is visible in Quick Actions', async ({ page }) => {
    const reviewCard = page.locator('text=Review Queue').first();
    await expect(reviewCard).toBeVisible();
  });

  test('Start Studying button is visible', async ({ page }) => {
    const btn = page.locator('button', { hasText: 'Start Studying' }).first();
    await expect(btn).toBeVisible();
  });
});
