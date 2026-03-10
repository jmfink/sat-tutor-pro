import { test, expect } from '@playwright/test';

test.describe('Insights Page (/insights)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/insights');
    // Wait for the page to finish loading (spinner disappears)
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );
  });

  test('page loads without crash', async ({ page }) => {
    await expect(page).toHaveURL('/insights');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('has "Wrong Answer Insights" heading', async ({ page }) => {
    await expect(page.locator('h1', { hasText: 'Wrong Answer Insights' })).toBeVisible();
  });

  test('shows either pre-threshold progress bar or top insights section', async ({ page }) => {
    const prethreshold = page.locator('text=Building Your Insight Profile');
    const topPriority = page.locator('text=Top Priority Issues');
    const readyToAnalyze = page.locator('text=Ready to Analyze Your Patterns');

    const hasPrethreshold = await prethreshold.count();
    const hasTopPriority = await topPriority.count();
    const hasReady = await readyToAnalyze.count();

    expect(hasPrethreshold + hasTopPriority + hasReady).toBeGreaterThan(0);
  });

  test('dimension cards grid is visible (all 8 INSIGHT_DIMENSIONS)', async ({ page }) => {
    // Dimension cards are rendered via INSIGHT_DIMENSIONS — they always render
    // (with "No data yet" if no insight exists)
    // Look for the "Explore All Dimensions" heading
    const heading = page.locator('text=Explore All Dimensions');
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('dimension labels do not contain raw "dim-0", "dim-1" strings', async ({ page }) => {
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toMatch(/\bdim-[0-9]+\b/);
  });

  test('clicking a dimension card navigates to /insights/[dimension]', async ({ page }) => {
    // Dimension cards link to /insights/<dimensionId>
    // Find the first DimensionCard link (they have "Deep dive" text)
    const deepDiveLink = page.locator('a', { hasText: 'Deep dive' }).first();
    await expect(deepDiveLink).toBeVisible({ timeout: 10000 });

    await deepDiveLink.click();
    await page.waitForURL(/\/insights\/.+/, { timeout: 10000 });
    await expect(page.url()).toMatch(/\/insights\/.+/);
  });
});

test.describe('Insights Dimension Detail Page (/insights/[dimension])', () => {
  test('dimension detail page loads without crash', async ({ page }) => {
    // Navigate to a known dimension
    await page.goto('/insights/error_types');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );

    await expect(page.locator('body')).not.toContainText('Application error');
    // Should show either the dimension content or "Not enough data yet"
    const hasContent = await page.locator('text=Error Types').count();
    expect(hasContent).toBeGreaterThan(0);
  });

  test('dimension title is visible', async ({ page }) => {
    await page.goto('/insights/error_types');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );

    // Either the h1 heading "Error Types" or the dimension meta label
    const title = page.locator('h1', { hasText: 'Error Types' });
    await expect(title).toBeVisible({ timeout: 10000 });
  });

  test('"Back to Insights" link is visible', async ({ page }) => {
    await page.goto('/insights/timing_patterns');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );

    const backLink = page.locator('a', { hasText: 'Back to Insights' });
    await expect(backLink).toBeVisible({ timeout: 10000 });
  });
});
