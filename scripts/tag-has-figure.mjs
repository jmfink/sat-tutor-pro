/**
 * scripts/tag-has-figure.mjs
 *
 * Detects uploaded_pdf questions whose question_text references a graph,
 * figure, table, or diagram that cannot be displayed (image-only content).
 * Tags them with 'has_figure' so they are excluded from study sessions.
 *
 * Usage:
 *   node scripts/tag-has-figure.mjs          # dry-run (report only)
 *   node scripts/tag-has-figure.mjs --apply  # report + apply tags
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
// Detection patterns — any of these phrases in question_text indicates a
// question that depends on a visual (graph/figure/table/diagram) not available
// as text. Patterns are matched case-insensitively.
// ---------------------------------------------------------------------------
const FIGURE_PHRASES = [
  'the figure',
  'the graph',
  'the diagram',
  'the chart',
  'the table above',
  'the table below',
  'shown above',
  'shown below',
  'figure 1',
  'figure 2',
  'figure 3',
  'graph above',
  'graph below',
  'in the figure',
  'based on the figure',
  'based on the graph',
  'based on the table',
  'based on the diagram',
  'according to the figure',
  'according to the graph',
  'according to the table',
  'according to the diagram',
  'as shown in',
  'shown in the',
];

function hasFigureReference(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return FIGURE_PHRASES.some(phrase => lower.includes(phrase));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const applyTags = process.argv.includes('--apply');

console.log(`\n=== SAT Tutor — Has-Figure Tag Script ===`);
console.log(`Mode: ${applyTags ? 'APPLY (will tag affected questions)' : 'DRY RUN (report only)'}\n`);

// Fetch all questions in pages
let allQuestions = [];
let from = 0;
const PAGE = 1000;

process.stdout.write('Fetching questions');
while (true) {
  const { data, error } = await supabase
    .from('questions')
    .select('question_id, question_text, source, tags')
    .range(from, from + PAGE - 1);

  if (error) { console.error('\nFetch error:', error.message); process.exit(1); }
  if (!data || data.length === 0) break;

  allQuestions = allQuestions.concat(data);
  process.stdout.write('.');
  if (data.length < PAGE) break;
  from += PAGE;
}
console.log(` ${allQuestions.length} questions loaded.\n`);

// Detect
const affected = [];
for (const q of allQuestions) {
  const existing = Array.isArray(q.tags) ? q.tags : [];
  if (existing.includes('has_figure')) continue; // already tagged
  if (hasFigureReference(q.question_text)) {
    affected.push(q);
  }
}

// Report
console.log(`--- Results ---`);
console.log(`Total questions  : ${allQuestions.length}`);
console.log(`Already tagged   : ${allQuestions.filter(q => (q.tags ?? []).includes('has_figure')).length}`);
console.log(`Newly detected   : ${affected.length}`);

if (affected.length > 0) {
  console.log(`\nSample questions with figure references (first 10):`);
  for (const q of affected.slice(0, 10)) {
    const preview = (q.question_text ?? '').slice(0, 120).replace(/\n/g, ' ');
    console.log(`  [${q.source}] ${q.question_id}`);
    console.log(`    Text: "${preview}${preview.length === 120 ? '…' : ''}"`);
  }
  if (affected.length > 10) console.log(`  … and ${affected.length - 10} more.`);
}

if (!applyTags) {
  console.log(`\nTo tag affected questions, re-run with --apply:`);
  console.log(`  node scripts/tag-has-figure.mjs --apply\n`);
  process.exit(0);
}

console.log(`\nTagging ${affected.length} questions with 'has_figure'…`);
let taggedCount = 0;
let errors = 0;

for (const q of affected) {
  const existing = Array.isArray(q.tags) ? q.tags : [];
  const { error } = await supabase
    .from('questions')
    .update({ tags: [...existing, 'has_figure'] })
    .eq('question_id', q.question_id);

  if (error) {
    console.warn(`  Warning: failed to tag ${q.question_id}: ${error.message}`);
    errors++;
  } else {
    taggedCount++;
  }
}

console.log(`\n--- Tagging complete ---`);
console.log(`  Newly tagged : ${taggedCount}`);
if (errors > 0) console.log(`  Errors       : ${errors}`);
console.log(`\nThese questions will now be excluded from study sessions.\n`);
