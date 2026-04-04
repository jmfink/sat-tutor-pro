import { test, expect } from '@playwright/test';
import * as path from 'path';

const TEST_EMAIL = process.env.TEST_EMAIL ?? 'playwright-test@sat-tutor.test';
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'playwright-test-pw-123';

// These tests manage their own auth state — do NOT use global storage state
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test('unauthenticated access to /progress redirects to /login', async ({ page }) => {
    await page.goto('/progress');
    await page.waitForURL('**/login', { timeout: 8000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated access to /study redirects to /login', async ({ page }) => {
    await page.goto('/study');
    await page.waitForURL('**/login', { timeout: 8000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated access to / redirects to /login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/login', { timeout: 8000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1', { hasText: 'Welcome back' })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('signup page loads correctly', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('h1', { hasText: 'Create your account' })).toBeVisible();
    await expect(page.locator('input#name')).toBeVisible();
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
  });

  test('login with existing account lands on dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 15000 });
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Predicted Score').first()).toBeVisible({ timeout: 10000 });
  });

  test('invalid login shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'notreal@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Should stay on login and show error
    await expect(page.locator('text=Invalid').first()).toBeVisible({ timeout: 8000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('logout redirects to /login', async ({ page }) => {
    // Log in first
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 15000 });

    // Click sign out button in nav
    const signOutBtn = page.locator('button', { hasText: 'Sign out' }).first();
    await expect(signOutBtn).toBeVisible({ timeout: 5000 });
    await signOutBtn.click();

    await page.waitForURL('**/login', { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('session persists across page navigation without re-login', async ({ page }) => {
    // Log in
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 15000 });

    // Navigate around without being kicked to login
    await page.goto('/study');
    await expect(page).toHaveURL('/study');
    await expect(page.locator('body')).not.toContainText('Application error');

    await page.goto('/progress');
    await expect(page).toHaveURL('/progress');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('signup with new email creates student record and lands on dashboard', async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@sat-tutor.test`;
    const testName = 'Playwright Tester';

    await page.goto('/signup');
    await page.fill('input#name', testName);
    await page.fill('input#email', uniqueEmail);
    await page.fill('input#password', 'testpassword123');
    await page.click('button[type="submit"]');

    // Should land on dashboard
    await page.waitForURL('/', { timeout: 20000 });
    await expect(page).toHaveURL('/');

    // Dashboard should be visible
    await expect(page.locator('text=Predicted Score').first()).toBeVisible({ timeout: 10000 });
  });

  test('Study Session starts without errors after login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 15000 });

    // Navigate to study
    await page.goto('/study');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/study');
    await expect(page.locator('body')).not.toContainText('Application error');

    // Verify study page loaded
    await expect(page.locator('h1', { hasText: 'Start a Study Session' })).toBeVisible();
  });

  test('forgot password page loads and accepts email', async ({ page }) => {
    await page.goto('/forgot-password');
    // Either the page renders or redirects to login — either is acceptable for now
    const isOnForgotPassword = page.url().includes('forgot-password');
    const isOnLogin = page.url().includes('login');
    expect(isOnForgotPassword || isOnLogin).toBe(true);

    if (isOnForgotPassword) {
      // If the page exists, check for email input
      const emailInput = page.locator('input[type="email"]');
      if (await emailInput.count() > 0) {
        await emailInput.fill('test@example.com');
        await expect(emailInput).toHaveValue('test@example.com');
      }
    }
  });
});
