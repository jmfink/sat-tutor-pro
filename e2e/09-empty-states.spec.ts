/**
 * 09-empty-states.spec.ts
 *
 * Tests first-time / empty-state UX by intercepting all /api/ requests and
 * returning empty / zero payloads, simulating a brand-new student who has
 * never answered a question.
 *
 * For each check the test reports PASS / FAIL via standard Playwright assertions.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: intercept all /api/* with a single handler keyed on URL substring
// ---------------------------------------------------------------------------

async function mockEmptyState(page: Page) {
  await page.route('**/api/**', (route) => {
    const url = route.request().url();

    // Score predictions — no data
    if (url.includes('/api/claude/predict-score')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }

    // Streak / activity — 0 streak, empty calendar
    if (url.includes('/api/sessions/streak')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ currentStreak: 0, dailyActivity: [] }),
      });
    }

    // Sessions list (limit, skillRatings, etc.) — empty
    if (url.includes('/api/sessions') && !url.match(/\/api\/sessions\/[0-9a-f-]{36}/)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }

    // Wrong-answer insights — below threshold
    if (url.includes('/api/claude/analyze-patterns')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ wrong_answers_count: 0, insight: null }),
      });
    }

    // Review queue count — 0
    if (url.includes('/api/review') && url.includes('countOnly=true')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0 }) });
    }

    // Review queue list — empty
    if (url.includes('/api/review')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }

    // Everything else (Next.js chunks, etc.) — pass through
    route.continue();
  });
}

// ---------------------------------------------------------------------------
// Shared wait helper
// ---------------------------------------------------------------------------

async function waitForSpinner(page: Page, ms = 20000) {
  await page.waitForFunction(() => !document.querySelector('.animate-spin'), { timeout: ms });
}

// ---------------------------------------------------------------------------
// 1. Progress (/progress) — empty state checks
// ---------------------------------------------------------------------------

test.describe('Progress page — empty state', () => {
  test.beforeEach(async ({ page }) => {
    await mockEmptyState(page);
    await page.goto('/progress');
    await waitForSpinner(page);
  });

  test('Skill map: no skill cell shows red "Developing" label when nothing attempted', async ({ page }) => {
    const skillMapSection = page.locator('text=Skill Map').first();
    await expect(skillMapSection).toBeVisible();

    // With no attempts every cell should show "Not yet practiced" (neutral gray).
    // The only place "developing" can appear is the legend entry "Developing (<1100)".
    // Count all case-insensitive matches — must be ≤ 1 (the legend only).
    const bodyText = await page.locator('body').textContent() ?? '';
    const developingCount = (bodyText.match(/\bdeveloping\b/gi) ?? []).length;
    expect(
      developingCount,
      'Only the legend should mention "Developing"; skill cells should not'
    ).toBeLessThanOrEqual(1);
  });

  test('Skill map: "Not yet practiced" label appears for unattempted skills', async ({ page }) => {
    // Skill map redesign: unattempted cells now show the skill ID (e.g. "M-01") rather
    // than the text "Not yet practiced". The legend still shows "Not practiced".
    // Wait for the skill map section to be present, then verify the legend entry.
    await expect(page.locator('text=Skill Map').first()).toBeVisible({ timeout: 10000 });
    const legendEntry = page.locator('text=Not practiced').first();
    await expect(legendEntry).toBeVisible({ timeout: 5000 });
  });

  test('Error Type Distribution: chart is hidden, placeholder text shown', async ({ page }) => {
    await expect(page.locator('text=Error Type Distribution').first()).toBeVisible();

    // Placeholder message replaces the pie chart
    await expect(page.locator('text=Error patterns will appear here')).toBeVisible({ timeout: 5000 });

    // No SVG (recharts) should render inside that card
    const card = page.locator('div.bg-white', { has: page.locator('text=Error Type Distribution') }).last();
    await expect(card.locator('svg')).toHaveCount(0);
  });

  test('Score Prediction History: no 4-digit SAT score shown when no data', async ({ page }) => {
    // Progress page redesign: Score Prediction History chart removed.
    // Score is now a "Predicted Score" stat card showing "—" when no data.
    test.skip(true, 'Score Prediction History section removed in redesign — score shown as stat card with "—" placeholder');
  });

  test('Session History: "No sessions yet" message shown', async ({ page }) => {
    await expect(page.locator('text=No sessions yet')).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// 2. Insights (/insights) — empty state checks
// ---------------------------------------------------------------------------

test.describe('Insights page — empty state', () => {
  test.beforeEach(async ({ page }) => {
    await mockEmptyState(page);
    await page.goto('/insights');
    await waitForSpinner(page, 15000);
  });

  test('Shows pre-threshold state: "Building Your Insight Profile" heading visible', async ({ page }) => {
    await expect(
      page.locator('text=Building Your Insight Profile')
    ).toBeVisible({ timeout: 10000 });
  });

  test('Pre-threshold progress bar is visible', async ({ page }) => {
    await expect(page.locator('[role="progressbar"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('Top Priority Issues section is absent below threshold', async ({ page }) => {
    await expect(page.locator('text=Top Priority Issues')).toHaveCount(0);
  });

  test('"Explore All Dimensions" section is absent below threshold (no phantom dimension data)', async ({ page }) => {
    // The dimension cards section only renders post-threshold (hasThreshold && insight).
    // Below threshold, it must be completely absent — no fabricated findings can appear.
    await expect(page.locator('text=Explore All Dimensions')).toHaveCount(0);
    // Also verify no "Top Priority Issues" section leaked through
    await expect(page.locator('text=Top Priority Issues')).toHaveCount(0);
  });

  test('Raw dim-N fallback labels are not visible anywhere', async ({ page }) => {
    const bodyText = await page.locator('body').textContent() ?? '';
    expect(bodyText).not.toMatch(/\bdim-[0-9]+\b/);
  });
});

// ---------------------------------------------------------------------------
// 3. Review Queue (/review) — empty state checks
// ---------------------------------------------------------------------------

test.describe('Review Queue — empty state', () => {
  test.beforeEach(async ({ page }) => {
    await mockEmptyState(page);
    await page.goto('/review');
    await waitForSpinner(page, 15000);
  });

  test('Shows "Queue is empty" message when no cards are due', async ({ page }) => {
    await expect(page.locator('text=Queue is empty')).toBeVisible({ timeout: 10000 });
  });

  test('"0 cards due" banner includes a friendly message (not a bare zero count)', async ({ page }) => {
    // The UI shows "0 cards due" — verify it is accompanied by the friendly
    // "You're all caught up." message so the zero is contextualised, not confusing.
    const zeroBanner = page.locator('text=0 cards due');
    await expect(zeroBanner).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=You're all caught up.")).toBeVisible({ timeout: 5000 });
  });

  test('Start Review Session button is absent when queue is empty', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'Start Review Session' })).toHaveCount(0);
  });

  test('Page loads without crash', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page.locator('h1', { hasText: 'Review Queue' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. Dashboard (/) — empty state checks
// ---------------------------------------------------------------------------

test.describe('Dashboard — empty state', () => {
  test.beforeEach(async ({ page }) => {
    await mockEmptyState(page);
    // networkidle: all mocked API calls resolve immediately so the network
    // goes idle quickly. The nav sidebar has a persistent animate-pulse when
    // prediction is null — we cannot wait for that to disappear.
    await page.goto('/', { waitUntil: 'networkidle' });
    // Allow React state updates to flush after all fetches complete
    await page.waitForTimeout(500);
  });

  test('Streak shows 0 with "Study today to start" sub-label', async ({ page }) => {
    // Dashboard redesign: streak number uses text-4xl (not text-5xl); sub-label copy
    // changed from "Start today!" to "Study today to start"
    const streakNum = page.locator('span.text-4xl').first();
    await expect(streakNum).toHaveText('0', { timeout: 5000 });
    await expect(page.locator('text=Study today to start')).toBeVisible({ timeout: 5000 });
  });

  test('Review Queue card has no badge when count is 0', async ({ page }) => {
    // Badge only renders when reviewCount > 0; "0 due" should never appear
    await expect(page.locator('text=0 due')).toHaveCount(0);
  });

  test('Score prediction widget shows unlock message', async ({ page }) => {
    // Dashboard redesign: no "—" placeholder — widget shows unlock copy directly.
    // Copy updated to "Complete 20 questions to unlock" (active voice).
    await expect(page.locator('text=Complete 20 questions to unlock').first()).toBeVisible({ timeout: 10000 });
  });

  test('Recent Sessions panel shows "No sessions yet"', async ({ page }) => {
    // Dashboard redesign: "Recent Sessions" panel removed from dashboard.
    // Weekly question count and accuracy are shown inline in the streak/stats widget.
    test.skip(true, 'Recent Sessions panel removed from dashboard in redesign — weekly stats shown inline in streak widget');
  });

  test('Page loads without crash', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});

// ---------------------------------------------------------------------------
// 5. Study Session — 0-questions-answered summary handles gracefully
// ---------------------------------------------------------------------------

test.describe('Study Session — zero questions answered summary', () => {
  const FAKE_SESSION_ID = '00000000-0000-0000-0000-000000000001';

  test('End Session immediately shows graceful 0-question summary dialog', async ({ page }) => {
    // Mock session detail endpoint
    await page.route(`**/api/sessions/${FAKE_SESSION_ID}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: FAKE_SESSION_ID,
          student_id: 'demo-student',
          session_type: 'study_session',
          started_at: new Date().toISOString(),
          questions_answered: 0,
          questions_correct: 0,
          accuracy: null,
        }),
      });
    });

    // Mock questions — delay long enough that we can click End Session first
    await page.route('**/api/questions**', async (route) => {
      await new Promise<void>((r) => setTimeout(r, 8000));
      route.fulfill({ status: 404, body: JSON.stringify({ error: 'No questions available' }) });
    });

    // Mock session summary
    await page.route('**/api/claude/session-summary**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ summary: null }),
      });
    });

    // Mock session PATCH and score-prediction POST
    await page.route('**/api/sessions**', (route) => {
      if (route.request().method() === 'PATCH') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
      route.continue();
    });

    await page.route('**/api/claude/predict-score**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto(`/study/${FAKE_SESSION_ID}`);

    // Wait for the session to load (the session fetch resolves quickly)
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin') || !!document.querySelector('button[class*="text-red"]'),
      { timeout: 10000 }
    );

    // Click End Session before any question is answered
    const endBtn = page.locator('button', { hasText: 'End Session' });
    await expect(endBtn).toBeVisible({ timeout: 8000 });
    await endBtn.click();

    // End Session dialog should open
    await expect(page.locator('text=Session Complete!')).toBeVisible({ timeout: 10000 });

    // Stats panel: 0 questions answered
    const statsArea = page.locator('[role="dialog"]').or(page.locator('text=Session Complete!').locator('..').locator('..').locator('..'));
    const dialogEl = page.locator('[role="dialog"]');

    const questionsBox = dialogEl.locator('div', { hasText: 'Questions' }).filter({ has: page.locator('p.text-2xl') });
    await expect(questionsBox.locator('p.text-2xl').first()).toHaveText('0', { timeout: 5000 });

    // Accuracy shows "—" not "0%" or "NaN%"
    const accuracyDash = dialogEl.locator('p.text-2xl', { hasText: '—' });
    await expect(accuracyDash).toBeVisible({ timeout: 5000 });

    // No "NaN" or "Infinity" anywhere in the dialog
    const dialogText = await dialogEl.textContent() ?? '';
    expect(dialogText, 'Dialog must not contain NaN').not.toContain('NaN');
    expect(dialogText, 'Dialog must not contain Infinity').not.toContain('Infinity');

    // Fallback summary text shown when summary API returns null
    await expect(dialogEl.locator('text=Great work pushing through today')).toBeVisible({ timeout: 5000 });

    // Both action buttons present
    await expect(dialogEl.locator('button', { hasText: 'Go to Dashboard' })).toBeVisible();
    await expect(dialogEl.locator('button', { hasText: 'Keep Studying' })).toBeVisible();
  });
});
