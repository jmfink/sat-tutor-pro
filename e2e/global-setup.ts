import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';

// Load .env.local so SUPABASE_SERVICE_ROLE_KEY and friends are available
loadDotenv({ path: path.join(__dirname, '..', '.env.local') });

const AUTH_FILE = path.join(__dirname, '.auth', 'user.json');
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL ?? 'playwright-test@sat-tutor.test';
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'playwright-test-pw-123';
const TEST_NAME = 'Test Student';

async function globalSetup() {
  // Ensure .auth directory exists
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Try logging in first (account may already exist)
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');

  try {
    // Wait for redirect to dashboard (success) or error message
    await Promise.race([
      page.waitForURL(`${BASE_URL}/`, { timeout: 8000 }),
      page.waitForSelector('text=Invalid login credentials', { timeout: 8000 }),
    ]);
  } catch {
    // Timeout — something unexpected, will try signup
  }

  const currentUrl = page.url();
  const onDashboard = currentUrl === `${BASE_URL}/` || currentUrl.endsWith('/');

  if (!onDashboard) {
    // Login failed — try signing up
    await page.goto(`${BASE_URL}/signup`);
    await page.waitForLoadState('networkidle');

    await page.fill('input#name', TEST_NAME);
    await page.fill('input#email', TEST_EMAIL);
    await page.fill('input#password', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL(`${BASE_URL}/`, { timeout: 15000 });
  }

  // Ensure the student name in the DB matches TEST_NAME regardless of how the
  // account was created. Use the admin client directly (bypasses RLS) to avoid
  // cookie/auth issues in the browser context.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Find the auth user by email
  const { data: usersData, error: usersError } = await admin.auth.admin.listUsers();
  if (usersError) {
    console.warn(`[Playwright] Could not list users: ${usersError.message}`);
  } else {
    const testUser = usersData.users.find((u) => u.email === TEST_EMAIL);
    if (!testUser) {
      console.warn(`[Playwright] Test user not found in auth: ${TEST_EMAIL}`);
    } else {
      const { error: updateError } = await admin
        .from('students')
        .update({ name: TEST_NAME })
        .eq('id', testUser.id);
      if (updateError) {
        console.warn(`[Playwright] Failed to update student name: ${updateError.message}`);
      } else {
        console.log(`[Playwright] Student name set to "${TEST_NAME}" for user ${testUser.id}`);
      }
    }
  }

  // Save auth state
  await context.storageState({ path: AUTH_FILE });
  await browser.close();

  console.log(`[Playwright] Auth state saved for ${TEST_EMAIL}`);
}

export default globalSetup;
