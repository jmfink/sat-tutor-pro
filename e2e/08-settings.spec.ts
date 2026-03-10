import { test, expect } from '@playwright/test';

test.describe('Settings Page (/settings)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('page loads without crash', async ({ page }) => {
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('has "Settings" heading', async ({ page }) => {
    await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible();
  });

  test('Learning Preferences section is visible', async ({ page }) => {
    await expect(page.locator('text=Learning Preferences').first()).toBeVisible();
  });

  test('explanation style options are visible', async ({ page }) => {
    await expect(page.locator('text=Preferred Explanation Style').first()).toBeVisible();
    // Should see Visual, Algebraic, Analogy, Elimination buttons
    await expect(page.locator('button', { hasText: 'Visual' }).first()).toBeVisible();
    await expect(page.locator('button', { hasText: 'Algebraic' }).first()).toBeVisible();
  });

  test('Tutor Behavior section with Socratic Mode toggle is visible', async ({ page }) => {
    await expect(page.locator('text=Tutor Behavior').first()).toBeVisible();
    await expect(page.locator('text=Socratic Mode').first()).toBeVisible();
  });

  test('Socratic Mode toggle works', async ({ page }) => {
    const toggle = page.locator('button[role="switch"]').first();
    await expect(toggle).toBeVisible();
    const initialState = await toggle.getAttribute('aria-checked');
    await toggle.click();
    const newState = await toggle.getAttribute('aria-checked');
    // State should have toggled
    expect(newState).not.toEqual(initialState);
  });

  test('Appearance section with Dark Mode toggle is visible', async ({ page }) => {
    await expect(page.locator('text=Appearance').first()).toBeVisible();
    await expect(page.locator('text=Dark Mode').first()).toBeVisible();
  });

  test('Parent Access section is visible', async ({ page }) => {
    await expect(page.locator('text=Parent Access').first()).toBeVisible();
    await expect(page.locator('text=Go to Parent Dashboard').first()).toBeVisible();
  });

  test('Danger Zone (Reset Progress) section is visible', async ({ page }) => {
    await expect(page.locator('text=Danger Zone').first()).toBeVisible();
    await expect(page.locator('button', { hasText: 'Reset Progress' }).first()).toBeVisible();
  });

  test('Save Settings button is visible and clickable', async ({ page }) => {
    const saveBtn = page.locator('button', { hasText: 'Save Settings' }).first();
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();
    // Should show "Saved!" confirmation
    await expect(page.locator('button', { hasText: 'Saved!' }).first()).toBeVisible({ timeout: 3000 });
  });

  test('clicking explanation style updates selection', async ({ page }) => {
    // Click "Visual" style
    const visualBtn = page.locator('button', { hasText: 'Visual' }).first();
    await visualBtn.click();
    // Should now have the selected state (border-blue-500 class)
    await expect(visualBtn).toHaveClass(/border-blue-500/);
  });
});
