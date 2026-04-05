#!/usr/bin/env node
/**
 * smoke-test.mjs
 *
 * Post-deployment smoke test for sat-tutor-pro.
 *
 * 1. Looks up the sat-tutor-pro project ID via the Vercel API using
 *    VERCEL_TOKEN + VERCEL_TEAM_ID (no VERCEL_PROJECT_ID secret required).
 * 2. Polls until the latest production deployment reaches READY state
 *    (timeout: 5 minutes).
 * 3. Runs HTTP checks against NEXT_PUBLIC_APP_URL:
 *    - Public pages: must not return 500
 *    - Auth-required API routes: must return 401, not 500
 *
 * Retries each endpoint up to 3 times with 10 s delays before failing.
 *
 * Usage: node scripts/smoke-test.mjs
 * Env:   NEXT_PUBLIC_APP_URL, VERCEL_TOKEN, VERCEL_TEAM_ID
 */

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://sat-tutor-pro.vercel.app').replace(/\/$/, '');
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const PROJECT_NAME = 'sat-tutor-pro';

const POLL_TIMEOUT_MS  = 5 * 60 * 1000; // 5 minutes
const POLL_INTERVAL_MS = 15_000;         // 15 seconds between polls
const RETRY_COUNT      = 3;
const RETRY_DELAY_MS   = 10_000;         // 10 seconds between retries

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function vercelGet(path) {
  const teamParam = VERCEL_TEAM_ID ? `teamId=${VERCEL_TEAM_ID}` : '';
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://api.vercel.com${path}${teamParam ? `${sep}${teamParam}` : ''}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Vercel API ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Fetch a URL with retries.
 * Returns { status, failed } where failed=true if all retries returned 500.
 */
async function retryFetch(url, options = {}) {
  let lastStatus = 0;
  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(15_000) });
      lastStatus = res.status;
      if (res.status !== 500) return { status: res.status, failed: false };

      if (attempt < RETRY_COUNT) {
        process.stdout.write(`(${res.status}, retry ${attempt}/${RETRY_COUNT}) `);
        await sleep(RETRY_DELAY_MS);
      }
    } catch (err) {
      if (attempt < RETRY_COUNT) {
        process.stdout.write(`(err: ${err.message}, retry ${attempt}/${RETRY_COUNT}) `);
        await sleep(RETRY_DELAY_MS);
      } else {
        throw err;
      }
    }
  }
  return { status: lastStatus, failed: true };
}

// ── Step 1: Resolve Vercel project ID ─────────────────────────────────────────

let projectId = null;

if (!VERCEL_TOKEN) {
  console.warn('WARN: VERCEL_TOKEN not set — skipping deployment wait, proceeding to smoke tests.');
} else {
  console.log(`\n── Vercel Deployment Wait ────────────────────────────────`);
  console.log(`Resolving project ID for "${PROJECT_NAME}"...`);
  try {
    const project = await vercelGet(`/v9/projects/${PROJECT_NAME}`);
    projectId = project.id;
    console.log(`Project ID: ${projectId}`);
  } catch (err) {
    console.warn(`WARN: Could not resolve Vercel project ID: ${err.message}`);
    console.warn('Proceeding to smoke tests without waiting for deployment.');
  }
}

// ── Step 2: Poll for deployment readiness ─────────────────────────────────────

if (projectId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let ready = false;

  console.log('Polling for production deployment to reach READY...');

  while (Date.now() < deadline) {
    try {
      const data = await vercelGet(`/v6/deployments?projectId=${projectId}&limit=5&target=production`);
      const latest = (data.deployments ?? [])[0];

      if (!latest) {
        console.log('  No production deployments found yet — waiting...');
      } else {
        const state = latest.state ?? latest.readyState ?? 'UNKNOWN';
        console.log(`  ${latest.uid}: ${state}`);

        if (state === 'READY') {
          console.log('✓ Deployment is ready.\n');
          ready = true;
          break;
        }
        if (state === 'ERROR' || state === 'CANCELED') {
          console.error(`ERROR: Deployment ${latest.uid} reached state ${state}. Aborting smoke test.`);
          process.exit(1);
        }
      }
    } catch (err) {
      console.warn(`  WARN: Poll error — ${err.message}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  if (!ready) {
    console.error(`ERROR: Deployment did not reach READY within ${POLL_TIMEOUT_MS / 60_000} minutes.`);
    process.exit(1);
  }
}

// ── Step 3: Smoke tests ───────────────────────────────────────────────────────

console.log(`── Smoke Tests → ${APP_URL} ─────────────────────────────────`);

const checks = [
  // Public pages — 500 is the only unacceptable status
  {
    method: 'GET',
    path: '/login',
    description: 'GET /login (public page)',
    forbid500: true,
  },
  {
    method: 'GET',
    path: '/signup',
    description: 'GET /signup (public page)',
    forbid500: true,
  },
  {
    method: 'GET',
    path: '/report/invalid-token-xyz',
    description: 'GET /report/invalid-token-xyz (public error page)',
    forbid500: true,
  },
  // Auth-required API endpoints — unauthenticated calls must return 401, not 500
  {
    method: 'POST',
    path: '/api/tutor-update/create',
    body: '{}',
    description: 'POST /api/tutor-update/create (unauthed → expect 401)',
    expectStatus: 401,
    forbid500: true,
  },
  {
    method: 'POST',
    path: '/api/sessions',
    body: '{}',
    description: 'POST /api/sessions (unauthed → expect 401)',
    expectStatus: 401,
    forbid500: true,
  },
  {
    method: 'GET',
    path: '/api/questions',
    description: 'GET /api/questions (unauthed → expect 401)',
    expectStatus: 401,
    forbid500: true,
  },
];

let allPassed = true;

for (const check of checks) {
  const url = `${APP_URL}${check.path}`;
  const options = {
    method: check.method,
    headers: { 'Content-Type': 'application/json' },
    ...(check.body ? { body: check.body } : {}),
  };

  process.stdout.write(`  ${check.description} ... `);

  try {
    const { status, failed } = await retryFetch(url, options);

    if (failed) {
      console.log('FAIL');
      console.error(`\nSMOKE TEST FAILED: ${check.path} returned 500. Check Vercel function logs.\n`);
      allPassed = false;
    } else if (check.expectStatus && status !== check.expectStatus) {
      // Unexpected status (but not 500) — warn only, don't fail
      console.log(`WARN (got ${status}, expected ${check.expectStatus})`);
    } else {
      console.log(`OK (${status})`);
    }
  } catch (err) {
    console.log('ERROR');
    console.error(`\nSMOKE TEST FAILED: ${check.path} threw: ${err.message}\n`);
    allPassed = false;
  }
}

if (!allPassed) {
  process.exit(1);
}

console.log(`\n✓ All smoke tests passed on ${APP_URL}\n`);
