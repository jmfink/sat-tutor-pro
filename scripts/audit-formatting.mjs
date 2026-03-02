/**
 * scripts/audit-formatting.mjs
 *
 * Detects questions with corrupted math/text formatting (PDF extraction
 * artefacts) and tags them with 'formatting_issues' so they are excluded
 * from study sessions.
 *
 * Usage:
 *   node scripts/audit-formatting.mjs          # dry-run (report only)
 *   node scripts/audit-formatting.mjs --apply  # report + apply tags
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Load env from .env.local
// ---------------------------------------------------------------------------
const envPath = join(__dirname, '..', '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ---------------------------------------------------------------------------
// Corruption-detection patterns
// Each entry: { name, test: (text) => boolean }
// ---------------------------------------------------------------------------
const PATTERNS = [
  {
    name: 'caret_exponent',
    description: 'Caret notation (x^2) — superscript lost during PDF extraction',
    test: t => t.includes('^'),
  },
  {
    name: 'replacement_char',
    description: 'Unicode replacement character U+FFFD — encoding failure',
    test: t => t.includes('\uFFFD'),
  },
  {
    name: 'mojibake',
    description: 'UTF-8 mojibake (â€, Ã©, Ã¢) — Latin-1 / UTF-8 mismatch',
    test: t => t.includes('â€') || t.includes('Ã©') || t.includes('Ã¢'),
  },
  {
    name: 'latex_remnant',
    description: 'Unprocessed LaTeX markup (\\frac, \\sqrt, \\left)',
    test: t => t.includes('\\frac') || t.includes('\\sqrt') || t.includes('\\left'),
  },
];

function detectIssues(text) {
  if (!text) return [];
  return PATTERNS.filter(p => p.test(text)).map(p => p.name);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const applyTags = process.argv.includes('--apply');

console.log(`\n=== SAT Tutor — Formatting Issues Audit ===`);
console.log(`Mode: ${applyTags ? 'APPLY (will tag affected questions)' : 'DRY RUN (report only)'}\n`);

// Fetch all questions in pages
let allQuestions = [];
let from = 0;
const PAGE = 1000;

process.stdout.write('Fetching questions');
while (true) {
  const { data, error } = await supabase
    .from('questions')
    .select('question_id, question_text, source, section, tags')
    .range(from, from + PAGE - 1);

  if (error) { console.error('\nFetch error:', error.message); process.exit(1); }
  if (!data || data.length === 0) break;

  allQuestions = allQuestions.concat(data);
  process.stdout.write('.');
  if (data.length < PAGE) break;
  from += PAGE;
}
console.log(` ${allQuestions.length} questions loaded.\n`);

// Summarise by source
const bySource = {};
for (const q of allQuestions) {
  bySource[q.source] = (bySource[q.source] ?? 0) + 1;
}
console.log('Questions by source:');
for (const [src, n] of Object.entries(bySource)) {
  console.log(`  ${src.padEnd(20)} ${n}`);
}

// Detect
const affected = [];
const patternTotals = Object.fromEntries(PATTERNS.map(p => [p.name, 0]));

for (const q of allQuestions) {
  const issues = detectIssues(q.question_text ?? '');
  if (issues.length === 0) continue;
  for (const name of issues) patternTotals[name]++;
  affected.push({ ...q, issues });
}

// Report
console.log(`\n--- Results ---`);
console.log(`Total questions  : ${allQuestions.length}`);
console.log(`Affected         : ${affected.length} (${((affected.length / allQuestions.length) * 100).toFixed(1)}%)`);
console.log(`\nBreakdown by pattern:`);
for (const p of PATTERNS) {
  const n = patternTotals[p.name];
  if (n > 0) console.log(`  ${p.name.padEnd(22)} ${n}  — ${p.description}`);
}

if (affected.length > 0) {
  console.log(`\nSample affected questions (first 10):`);
  for (const q of affected.slice(0, 10)) {
    const preview = (q.question_text ?? '').slice(0, 100).replace(/\n/g, ' ');
    console.log(`  [${q.source}] ${q.question_id}`);
    console.log(`    Issues : ${q.issues.join(', ')}`);
    console.log(`    Text   : "${preview}${preview.length === 100 ? '…' : ''}"`);
  }
  if (affected.length > 10) console.log(`  … and ${affected.length - 10} more.`);
}

// Apply tags if --apply
if (!applyTags) {
  console.log(`\nTo tag affected questions, re-run with --apply:`);
  console.log(`  node scripts/audit-formatting.mjs --apply\n`);
  process.exit(0);
}

console.log(`\nTagging ${affected.length} questions with 'formatting_issues'…`);
let taggedCount = 0;
let alreadyTagged = 0;
let errors = 0;

for (const q of affected) {
  const existing = Array.isArray(q.tags) ? q.tags : [];
  if (existing.includes('formatting_issues')) {
    alreadyTagged++;
    continue;
  }

  const { error } = await supabase
    .from('questions')
    .update({ tags: [...existing, 'formatting_issues'] })
    .eq('question_id', q.question_id);

  if (error) {
    console.warn(`  Warning: failed to tag ${q.question_id}: ${error.message}`);
    errors++;
  } else {
    taggedCount++;
  }
}

console.log(`\n--- Tagging complete ---`);
console.log(`  Newly tagged    : ${taggedCount}`);
console.log(`  Already tagged  : ${alreadyTagged}`);
if (errors > 0) console.log(`  Errors          : ${errors}`);
console.log(`\nThese questions will now be excluded from study sessions.`);
console.log(`To make the exclusion permanent via a DB column, apply:`);
console.log(`  supabase/migrations/002_add_formatting_issues_flag.sql\n`);
