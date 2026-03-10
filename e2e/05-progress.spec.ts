import { test, expect } from '@playwright/test';

test.describe('Progress Page (/progress)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/progress');
    // Wait for spinner to disappear (page fetches several APIs)
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 20000 }
    );
  });

  test('page loads without crash', async ({ page }) => {
    await expect(page).toHaveURL('/progress');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('has "My Progress" heading', async ({ page }) => {
    await expect(page.locator('h1', { hasText: 'My Progress' })).toBeVisible();
  });

  test('Score Prediction History section is visible', async ({ page }) => {
    const section = page.locator('text=Score Prediction History').first();
    await expect(section).toBeVisible();
  });

  test('chart container renders (SVG or recharts container)', async ({ page }) => {
    // ProgressChart uses recharts which renders an SVG
    const chart = page.locator('.recharts-wrapper, svg').first();
    await expect(chart).toBeVisible({ timeout: 10000 });
  });

  test('Study Streak section is visible', async ({ page }) => {
    const section = page.locator('text=Study Streak').first();
    await expect(section).toBeVisible();
  });

  test('Skill Map section is visible', async ({ page }) => {
    const section = page.locator('text=Skill Map').first();
    await expect(section).toBeVisible();
  });

  test('Session History section is visible', async ({ page }) => {
    const section = page.locator('text=Session History').first();
    await expect(section).toBeVisible();
  });

  test('Error Type Distribution section is visible', async ({ page }) => {
    const section = page.locator('text=Error Type Distribution').first();
    await expect(section).toBeVisible();
  });
});
