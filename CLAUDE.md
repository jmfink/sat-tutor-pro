# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product Philosophy

The user is a motivated high-school student (15–17) preparing for the SAT. Every design decision should serve their confidence and score.

- **Icons + words together** — never icons alone. Students learn the interface faster when text accompanies every icon.
- **Direct, confident language** — no hedging. "Answer 20 questions to unlock" not "You may be able to see your score after answering some questions."
- **Whitespace earns trust** — dense UIs feel like homework. Generous spacing makes hard work feel achievable.
- **Surface the intelligence** — the AI is doing real work; make it visible. Show Elo ratings, phase indicators, pattern counts. Students should feel the system learning them.
- **End on a win** — session summaries, streaks, and feedback should leave the student feeling capable, not graded.
- **Delight in details** — phase labels ("Peak zone"), micro-transitions, and contextual encouragement are not polish — they're the product.

## Voice and Tone

The app and user guide should feel like they were written by the same person. That person is a sharp, encouraging coach — not a textbook author, not a startup bro, not a children's app.

Rules that apply everywhere — app UI copy, user guide, session summaries, error messages, empty states, tooltips:

- **Short over long.** If it can be said in 4 words, don't use 8. "Adaptive practice session" not "An adaptive practice session that selects questions based on your skill levels and focuses on your weakest areas."
- **Active over passive.** "Start studying" not "A study session can be started here."
- **Direct over hedging.** "Complete 20 questions to unlock" not "Answer 20+ questions to unlock your personalized score prediction."
- **Confident over apologetic.** Never say "try to" or "you may want to" or "it's recommended that."
- **Specific over vague.** "8 dimensions" not "multiple dimensions." "Elo 970" not "below average." "3 days until your next milestone" not "keep going."
- **Teenager-appropriate but never dumbed down.** This student is smart and working hard toward a real goal. Treat them that way. No exclamation points on every line. No emoji in serious moments. Encouragement should feel earned, not automatic.
- **Consistency between app and guide.** If the app calls something "Quick Drill," the user guide calls it "Quick Drill" — not "quick drill" or "a drill session." Labels, feature names, and nav items must match exactly across both.

When writing any copy — button labels, section headers, empty states, session summaries, user guide sections — run it through these rules before committing.

## Color System

Colors are not decoration — they carry meaning and trigger emotional responses. Use them consistently and intentionally.

- **Brand Blue #1E3A5F** — authority, trust, intelligence. App name, primary headings, nav active states.
- **Action Blue #2563EB** — focus, readiness, "let's go." Primary CTA buttons (Start Studying), key interactive elements.
- **Amber/Gold #D97706** — discovery, revelation, insight. Wrong Answer Insights feature exclusively. The "aha moment" color.
- **Emerald Green #059669** — growth, improvement, forward momentum. My Progress feature, correct answers, positive trends, mastery indicators.
- **Medium Blue #3B82F6** — focus, seriousness, real conditions. Practice Test feature. Slightly lighter than brand blue to feel energizing rather than heavy.
- **Violet #7C3AED** — memory, retention, depth. Review Queue feature exclusively. Spaced repetition is about building lasting memory.
- **Orange #EA580C** — energy, momentum, heat. Streak counter only. Sustained daily effort.
- **Red #DC2626** — alert, wrong, needs attention. Wrong answers, errors, regression warnings.
- **Slate/Gray** — neutral, inactive, not yet started. Unattempted skills, disabled states, secondary text.

Never use gray for primary actions or features — it communicates inactivity and dampens motivation. Never use multiple colors for the same feature across different parts of the app.

## Information Hierarchy

The order of features in navigation, dashboards, and any list must reflect the student's natural learning workflow — not arbitrary choices. The canonical order is:

1. **Study Session** — primary daily action, always first
2. **Practice Test** — formal assessment, second most important
3. **Review Queue** — follow-up on mistakes after studying
4. **Wrong Answer Insights** — periodic pattern analysis
5. **My Progress** — weekly overview and skill tracking
6. **Settings / User Guide / Parent Dashboard** — utility, always last

This order must be consistent everywhere: nav sidebar, dashboard tiles, any page that lists features or links. A student should be able to predict where something is based on its position in the workflow.

## Standing Instructions

- After every task — without exception — review what was built and update both `user-guide.md` and `sat-tutor-pro-spec.md` to reflect the current state of the app. This is not optional. Specifically:
  - `user-guide.md`: update any section affected by UI changes, copy changes, new features, removed features, or navigation changes. Make the actual edits — do not just flag what should change.
  - `sat-tutor-pro-spec.md`: update the relevant module sections to reflect implementation decisions, UI changes, color system, information hierarchy, and any features that differ from the original spec.
  - If a change affects the Color System or Information Hierarchy documented in CLAUDE.md, update those sections too.
  - In your response summary, explicitly state what was updated in each document and what section numbers were changed.
- The user guide source of truth is `user-guide.md` in the repo root. To regenerate the Word doc, run: `node scripts/generate-user-guide.mjs`. The Word doc styling is driven by the branding colors defined at the top of `user-guide.md` — if app colors change, update those values and regenerate.
- Always run `npx next lint && npx next build` before committing. Fix all errors; the two pre-existing warnings in `e2e/` files are acceptable.
- Always commit and push at the end of every task.
- Run the Playwright test suite after significant changes and report results.
- After any change that affects UI copy, layout, navigation, or user-facing behavior, run the full Playwright test suite before committing. If tests fail due to the changes (not pre-existing failures), fix the tests to match the new correct UI before pushing. Never push UI changes that leave new Playwright failures unresolved. In your response summary, report the test results and what was fixed.

## Commands

```bash
# Development
npm run dev          # Start dev server on localhost:3000

# Build & lint
npm run build        # Production build (also type-checks)
npx next lint        # ESLint

# Question bank maintenance
node scripts/audit-formatting.mjs --apply   # Tag newly corrupted questions

# E2E tests (requires running server)
npx playwright test                          # Full suite
npx playwright test e2e/02-study.spec.ts     # Single file
npx playwright test --grep "dashboard"       # By test name
```

## Deployment

- **Production**: sat-tutor-pro.vercel.app — auto-deploys on every push to `main`
- **Database**: Supabase project `puypljwcbplretqtexlj.supabase.co`
- Environment variables are managed in the Vercel dashboard — never commit `.env.local`
- Supabase migrations in `supabase/migrations/` must be run manually in the Supabase SQL editor

## Security

- **`.claude/` is in `.gitignore`** — never commit any files from this directory
- **Supabase admin key format**: the app now uses Supabase's new Secret API key format (`sb_secret_...`) instead of the legacy JWT-based service_role key (`eyJ...`). Never log, hardcode, or store API keys in tracked files.
- Never commit `.env.local` or any file containing secrets

## GitHub Actions / CI

- **Playwright CI** runs automatically on every push to `main` and every pull request (`.github/workflows/playwright.yml`)
- Required GitHub Secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `TEST_EMAIL`, `TEST_PASSWORD`

## Architecture Overview

**Next.js 15 App Router** — client components use `'use client'`. Pages live in `app/`, API routes in `app/api/`. Layout at `app/layout.tsx` wraps everything in `AuthProvider` + `AppShell`.

**Auth flow** — Supabase Auth with cookie-based sessions. `middleware.ts` protects all routes except `/login`, `/signup`, `/forgot-password`, and `/api/*`. After signup, a `SECURITY DEFINER` trigger (`migration 006`) auto-creates the `students` row from `auth.users`, reading name from `raw_user_meta_data`. Never insert into `students` from the browser client after signup — the trigger handles it.

**Three Supabase clients** (`lib/supabase.ts`):
- `createSupabaseBrowserClient()` — anon key, RLS enforced. Use in client components and the `useAuth()` hook.
- `createSupabaseRouteHandlerClient()` — async, reads cookies from `next/headers`, RLS enforced. Use in API routes when you need the auth'd user's identity.
- `createSupabaseAdminClient()` — service role, **bypasses RLS**. Use for all mutations in API routes. Aliased as `createSupabaseServerClient()` throughout existing routes.

**Auth context** (`components/auth-provider.tsx`) — exposes `{ user, userId, name, loading, signOut }` via `useAuth()`. All pages are client components that gate data fetching on `!loading && userId`. The `name` field is fetched from `students.name` after auth resolves.

**Question pipeline**:
1. `GET /api/questions` calls `selectNextSubSkill` → `selectTargetDifficulty` → `selectQuestion` (all in `lib/question-selector.ts`)
2. Difficulty target is adjusted by session phase (warm-up → ramp → peak → consolidation) and frustration flag
3. `POST /api/questions` records the attempt, runs ELO update (`lib/elo.ts`, K=40 until 5 attempts then K=20, bounds 400–1800), and adds wrong answers to `review_queue`
4. Questions tagged `formatting_issues` or `has_figure` are excluded from all queries

**ELO** — starting rating 1000. Difficulty→Elo mapping: 1→800, 2→950, 3→1100, 4→1300, 5→1500. Skill is `is_calibrated` after 5+ attempts.

**Spaced repetition** — SM-2 algorithm in `lib/spaced-repetition.ts`. Wrong answers enter the queue with `next_review_date = tomorrow`. `GET /api/review` returns due items.

**Claude integration** — `lib/claude.ts` wraps the Anthropic SDK. Prompt templates are Markdown files in `prompts/`. Streaming responses use SSE (`text/event-stream`). `ExplanationPanel` in `components/explanation-panel.tsx` handles the stream parsing and conversation history. Never call the Anthropic API from client components — all Claude API calls go through server-side routes in `/api/claude/`.

**AI models**:
- `claude-sonnet-4-20250514` — tutoring explanations, error classification, session summaries, strategy coaching
- `claude-opus-4-20250514` — pattern recognition / wrong-answer analysis (`/api/claude/analyze-patterns`), AI-generated questions

**Math rendering** — `lib/math-text.tsx` provides `renderMathText()` which converts caret notation (`x^2`, `x^(2n)`) and implicit patterns (`x2` → x²) to `<sup>` elements. Applied in `QuestionCard`, `ExplanationPanel`, and the practice test page. Do not change DB content — fix display only.

## Question Bank

- 744 total questions sourced from College Board practice tests pt_4 through pt_11, parsed from PDFs via the parent dashboard upload flow
- ~610 currently serveable after excluding questions tagged `formatting_issues` or `has_figure`
- Run `node scripts/audit-formatting.mjs --apply` periodically to detect and tag newly corrupted questions

## Student Accounts

- Student UUIDs come from `auth.uid()` — never hardcoded
- Two orphaned legacy records exist with hardcoded UUIDs (`ethan_001`: `00000000-0000-0000-0000-000000000001`, `jason_001`: `00000000-0000-0000-0000-000000000002`) — these have no auth accounts and will be cleaned up when those students create real accounts
- `NEXT_PUBLIC_DEFAULT_STUDENT_ID` and `NEXT_PUBLIC_STUDENT_NAME` are removed — do not use them
- `DEMO_STUDENT_ID` in `lib/constants.ts` exists only for legacy seed/dev references — never use it in pages or components
- Playwright test accounts (e.g. `playwright-test@sat-tutor.test`) are real Supabase Auth accounts — do not delete them

## Wrong Answer Intelligence

- Minimum 10 wrong answers required before insights are generated
- Pattern analysis runs after every 5 new wrong answers or at session start
- Full analysis uses `claude-opus-4-20250514` via `/api/claude/analyze-patterns`

## Key Conventions

**API routes** accept both camelCase and snake_case keys (`body.studentId ?? body.student_id`). Error responses are always `{ error: string }` with appropriate HTTP status. Wrap handlers in try-catch; use the `errMsg()` helper to safely stringify unknown errors.

**`useEffect` + `userId`** pattern for all data fetching in pages:
```typescript
useEffect(() => {
  if (!loading && userId) fetch(`/api/...?studentId=${userId}`)...;
}, [userId, loading]);
```

**Sessions table** `session_type` values: `quick_drill`, `study_session`, `timed_section`, `full_practice_test`, `review`. `SubSkillId` values are defined in `lib/constants.ts` (`SUB_SKILLS` array, IDs like `M-01`…`M-19`, `RW-01`…`RW-11`).

**Migrations**: 005 enables auth.uid()-based RLS (production); 006 installs the signup trigger. Migration 003 is a dev-only permissive policy that 005 reverts.

## Playwright Tests

Global setup (`e2e/global-setup.ts`) logs in or creates the test account (`TEST_EMAIL` env var, default `playwright-test@sat-tutor.test`) and saves cookies to `e2e/.auth/user.json`. All test files inherit this auth state. Tests in `e2e/10-auth.spec.ts` override with `test.use({ storageState: { cookies: [], origins: [] } })` to test unauthenticated flows.

The previously failing tests in specs 04, 06, and 09 have been fixed:
- Insights tests skip gracefully when the account is in a pre-threshold state (< 10 wrong answers)
- Review queue tests parse the numeric due count instead of matching text
- Empty-state strict mode violation fixed with `.first()`
