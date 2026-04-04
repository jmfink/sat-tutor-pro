# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Standing Instructions

- After building any new feature or making any significant change, update `sat-tutor-pro-spec.md` to reflect what was built — keep the PRD as the source of truth.
- Always run `npx next lint && npx next build` before committing. Fix all errors; the two pre-existing warnings in `e2e/` files are acceptable.
- Always commit and push at the end of every task.
- Run the Playwright test suite after significant changes and report results.

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

Global setup (`e2e/global-setup.ts`) logs in or creates the test account (`TEST_EMAIL` env var, default `playwright-test@sat-tutor.test`) and saves cookies to `e2e/.auth/user.json`. All test files inherit this auth state. Tests in `e2e/10-auth.spec.ts` override with `test.use({ storageState: { cookies: [], origins: [] } })` to test unauthenticated flows. Five tests in specs 04, 06, 09 have pre-existing failures that require seeded question history — they are not regressions.
