/**
 * scripts/tag-has-figure.mjs
 *
 * Detects questions whose question_text clearly requires viewing an external
 * visual (graph, figure, diagram, table) that is not available as text.
 * Tags them with 'has_figure' so they are excluded from study sessions.
 *
 * Usage:
 *   node scripts/tag-has-figure.mjs                    # dry-run (report only)
 *   node scripts/tag-has-figure.mjs --apply            # add tags for new matches
 *   node scripts/tag-has-figure.mjs --apply --untag    # also remove stale tags
 *
 * Design note:
 *   By default (--apply without --untag) this script ONLY adds new tags and
 *   never removes existing ones.  This preserves has_figure tags set by the
 *   PDF parser (Claude), which may detect visuals via context that the phrase
 *   list below would miss.
 *
 *   Pass --untag explicitly when you want to clean up stale tags from a
 *   previous, overly-broad phrase list — e.g. after updating FIGURE_PHRASES.
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
// Phrase list — each phrase unambiguously indicates that the student must
// view an external visual to answer the question.
//
// Deliberately excluded (false positives):
//   "the graph"     — fires on "the graph of y = f(x)" (pure math)
//   "the figure"    — too generic alone
//   "the table"     — fires on inline table definitions
//   "in the graph"  — fires on "in the graph of a function"
//   "as shown in"   — too generic
// ---------------------------------------------------------------------------
const FIGURE_PHRASES = [
  // Explicit "shown" qualifiers with the visual noun adjacent
  'the graph shown',
  'the figure shown',
  'the diagram shown',
  'the table shown',
  'the scatterplot shown',
  'the chart shown',
  'shown in the figure',
  'shown in the graph',
  'shown in the diagram',

  // Positional above/below — always requires seeing the page layout
  'shown above',
  'shown below',
  'figure above',
  'figure below',
  'graph above',
  'graph below',
  'table above',
  'table below',
  'diagram above',
  'diagram below',
  'scatterplot above',
  'scatterplot below',

  // "in the figure" — always refers to a labeled figure on the page
  'in the figure',

  // Numbered figures — always external visuals
  'figure 1',
  'figure 2',
  'figure 3',
  'figure 4',

  // "X is shown" — explicit declaration that a visual is on the page
  // Also catches "The graph of ... is shown" even when noun and "shown" are
  // separated by a long phrase.
  'is shown',

  // Chart/graph nouns + "shows" — visual is the subject delivering the data
  'the scatterplot shows',
  'the bar graph shows',
  'the bar chart shows',
  'the line graph shows',
  'the line graph,',          // "Based on the line graph, ..."
  'the line graph in',
  'the line graph above',
  'the line graph below',

  // Scatterplot-specific — any reference to a scatterplot requires the plot
  'the scatterplot',
  // "line of best fit" always references a scatter plot that must be visible
  'line of best fit',

  // "according to" — referencing a specific displayed visual
  'according to the graph',
  'according to the figure',
  'according to the diagram',
  'according to the scatterplot',

  // Reading/Writing quantitative questions that require a data graphic
  'which choice most effectively uses data from the graph',
  'which choice most effectively uses data from the table',
  'which choice most effectively uses data from the figure',
];

function hasFigureReference(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return FIGURE_PHRASES.some(phrase => lower.includes(phrase));
}

// Detect questions whose answer choices are "Graph A", "Graph B", etc.
// These questions ask students to identify which graph matches criteria —
// impossible without seeing the graphs.
const GRAPH_CHOICE_RE = /^graph\s+[a-d]$/i;

function hasGraphChoices(answer_choices) {
  if (!answer_choices || typeof answer_choices !== 'object') return false;
  const values = Object.values(answer_choices);
  return values.length > 0 && values.every(v => GRAPH_CHOICE_RE.test(String(v).trim()));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const applyTags  = process.argv.includes('--apply');
const doUntag    = process.argv.includes('--untag');  // opt-in only

const modeLabel = !applyTags
  ? 'DRY RUN (report only)'
  : doUntag
    ? 'APPLY + UNTAG (add new + remove stale)'
    : 'APPLY (add new tags only — preserves Claude-assigned tags)';

console.log(`\n=== SAT Tutor — Has-Figure Tag Script ===`);
console.log(`Mode: ${modeLabel}\n`);

// Fetch all questions in pages
let allQuestions = [];
let from = 0;
const PAGE = 1000;

process.stdout.write('Fetching questions');
while (true) {
  const { data, error } = await supabase
    .from('questions')
    .select('question_id, question_text, answer_choices, source, tags')
    .range(from, from + PAGE - 1);

  if (error) { console.error('\nFetch error:', error.message); process.exit(1); }
  if (!data || data.length === 0) break;

  allQuestions = allQuestions.concat(data);
  process.stdout.write('.');
  if (data.length < PAGE) break;
  from += PAGE;
}
console.log(` ${allQuestions.length} questions loaded.\n`);

// Classify every question
const shouldTag    = [];  // not currently tagged, but phrase-matches
const shouldUntag  = [];  // currently tagged, but no longer phrase-matches (only relevant with --untag)
const alreadyCorrect = []; // currently tagged AND phrase-matches

for (const q of allQuestions) {
  const tags = Array.isArray(q.tags) ? q.tags : [];
  const isTagged = tags.includes('has_figure');
  const matches  = hasFigureReference(q.question_text) || hasGraphChoices(q.answer_choices);

  if (!isTagged && matches)  { shouldTag.push(q); }
  else if (isTagged && !matches) { shouldUntag.push(q); }
  else if (isTagged && matches)  { alreadyCorrect.push(q); }
}

// Report
console.log(`--- Results ---`);
console.log(`Total questions            : ${allQuestions.length}`);
console.log(`Currently tagged (correct) : ${alreadyCorrect.length}`);
console.log(`To tag (new phrase matches): ${shouldTag.length}`);
console.log(`Stale tags (phrase no-match): ${shouldUntag.length}${doUntag ? ' — will be removed' : ' — skipped (run with --untag to remove)'}`);

if (shouldTag.length > 0) {
  console.log(`\nWill newly tag (first 10):`);
  for (const q of shouldTag.slice(0, 10)) {
    const preview = (q.question_text ?? '').slice(0, 120).replace(/\n/g, ' ');
    console.log(`  [${q.source}] ${q.question_id}`);
    console.log(`    "${preview}${preview.length === 120 ? '…' : ''}"`);
  }
  if (shouldTag.length > 10) console.log(`  … and ${shouldTag.length - 10} more.`);
}

if (doUntag && shouldUntag.length > 0) {
  console.log(`\nWill un-tag stale (first 10):`);
  for (const q of shouldUntag.slice(0, 10)) {
    const preview = (q.question_text ?? '').slice(0, 120).replace(/\n/g, ' ');
    console.log(`  [${q.source}] ${q.question_id}`);
    console.log(`    "${preview}${preview.length === 120 ? '…' : ''}"`);
  }
  if (shouldUntag.length > 10) console.log(`  … and ${shouldUntag.length - 10} more.`);
}

if (!applyTags) {
  console.log(`\nTo apply changes, re-run with --apply:`);
  console.log(`  node scripts/tag-has-figure.mjs --apply`);
  console.log(`  node scripts/tag-has-figure.mjs --apply --untag   # also remove stale\n`);
  process.exit(0);
}

// Apply: tag new phrase matches
let taggedCount = 0, untaggedCount = 0, tagErrors = 0;

if (shouldTag.length > 0) {
  console.log(`\nTagging ${shouldTag.length} questions with 'has_figure'…`);
  for (const q of shouldTag) {
    const existing = Array.isArray(q.tags) ? q.tags : [];
    const { error } = await supabase
      .from('questions')
      .update({ tags: [...existing, 'has_figure'] })
      .eq('question_id', q.question_id);
    if (error) { console.warn(`  Warning: ${q.question_id}: ${error.message}`); tagErrors++; }
    else taggedCount++;
  }
}

// Apply: un-tag stale (opt-in only)
if (doUntag && shouldUntag.length > 0) {
  console.log(`\nRemoving stale 'has_figure' tag from ${shouldUntag.length} questions…`);
  for (const q of shouldUntag) {
    const cleaned = (Array.isArray(q.tags) ? q.tags : []).filter(t => t !== 'has_figure');
    const { error } = await supabase
      .from('questions')
      .update({ tags: cleaned })
      .eq('question_id', q.question_id);
    if (error) { console.warn(`  Warning: ${q.question_id}: ${error.message}`); tagErrors++; }
    else untaggedCount++;
  }
}

const finalTagged = alreadyCorrect.length + taggedCount;
console.log(`\n--- Complete ---`);
console.log(`  Newly tagged          : ${taggedCount}`);
if (doUntag) console.log(`  Un-tagged (stale)     : ${untaggedCount}`);
console.log(`  Net total has_figure  : ${finalTagged}`);
if (tagErrors > 0) console.log(`  Errors                : ${tagErrors}`);
console.log('');
