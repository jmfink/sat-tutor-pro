#!/usr/bin/env node
/**
 * check-migrations.mjs
 *
 * Verifies that all local migration files in supabase/migrations/ have been
 * applied to the production Supabase database.
 *
 * Supabase CLI tracks applied migrations in supabase_migrations.schema_migrations
 * (version column). This project applies migrations manually via the SQL editor,
 * so that table may not exist — in which case the check warns and exits cleanly.
 *
 * Usage: node scripts/check-migrations.mjs
 * Env:   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n── Migration Sync Check ──────────────────────────────────');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.warn('WARN: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — skipping.');
  process.exit(0);
}

// Collect local migration filenames in sorted order
const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');
const localFiles = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`Local migration files (${localFiles.length}):`);
localFiles.forEach(f => console.log(`  ${f}`));

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

let appliedVersions = new Set();
let tableFound = false;

// Attempt 1: supabase_migrations.schema_migrations (Supabase CLI standard)
try {
  const { data, error } = await supabase
    .schema('supabase_migrations')
    .from('schema_migrations')
    .select('version');

  if (!error && Array.isArray(data)) {
    appliedVersions = new Set(data.map(r => String(r.version)));
    tableFound = true;
    console.log(`\nFound supabase_migrations.schema_migrations — ${data.length} applied migration(s)`);
  }
} catch (_) {
  // Schema not exposed via PostgREST — expected for manually-managed projects
}

// Attempt 2: public.schema_migrations fallback
if (!tableFound) {
  try {
    const { data, error } = await supabase
      .from('schema_migrations')
      .select('version');

    if (!error && Array.isArray(data)) {
      appliedVersions = new Set(data.map(r => String(r.version)));
      tableFound = true;
      console.log(`\nFound public.schema_migrations — ${data.length} applied migration(s)`);
    }
  } catch (_) {
    // Table doesn't exist in public schema either
  }
}

if (!tableFound) {
  console.warn('\nWARN: No migration tracking table found.');
  console.warn('Supabase CLI migration tracking is not in use for this project.');
  console.warn('Migrations are applied manually via the Supabase SQL editor.');
  console.warn('Skipping automated migration sync check.\n');
  process.exit(0);
}

if (appliedVersions.size === 0) {
  console.warn('\nWARN: Migration tracking table found but contains no entries.');
  console.warn('Cannot verify migration state — skipping comparison.\n');
  process.exit(0);
}

console.log('\nApplied versions recorded in DB:');
[...appliedVersions].sort().forEach(v => console.log(`  ${v}`));

// Compare: a local file is unapplied if neither its full name nor its stem
// (filename without .sql) appears in the applied versions set.
const unapplied = localFiles.filter(file => {
  const stem = file.replace(/\.sql$/, '');
  return !appliedVersions.has(file) && !appliedVersions.has(stem);
});

if (unapplied.length > 0) {
  console.error(`\nERROR: Unapplied migrations detected: ${unapplied.join(', ')}`);
  console.error('Run this migration in the Supabase SQL editor before merging.\n');
  process.exit(1);
}

console.log(`\n✓ All ${localFiles.length} local migrations are applied to production.\n`);
