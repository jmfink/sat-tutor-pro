/**
 * scripts/audit-serveable-quality.mjs
 *
 * Comprehensive quality audit of all serveable questions
 * (not tagged formatting_issues or has_figure).
 *
 * Checks:
 *   1. Missing parenthesis content  — "( +" or "( -" or "( ×" etc.
 *   2. Lost fraction bar             — newline followed by standalone number/expression
 *   3. Truncated question text       — under 20 characters
 *   4. Identical answer choices      — two or more choices share the same text
 *   5. Single-character answer choices — all choices are 1 char (not normal for SAT)
 *   6. "None of the above" / "All of the above" — not used on real SAT
 *   7. Placeholder or lorem text     — [blank], TBD, XXX, lorem
 *   8. Broken Unicode / garbled chars — replacement chars, weird control chars
 *   9. Answer choices that are just whitespace or empty
 *  10. Stray markdown artifacts      — leftover "**", "##", "---" in question text
 *  11. Orphaned answer key letters   — choices whose keys aren't A/B/C/D/E
 *  12. MC questions with only 1 or 2 choices (incomplete parse)
 *  13. Question text ending mid-sentence (last char is not punctuation/digit/letter)
 *  14. Duplicate question_text across different question_ids
 *  15. Passages attached to math questions (likely mis-classification)
 *
 * Run: node scripts/audit-serveable-quality.mjs
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8').split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

console.log('Fetching all questions…');
const { data: allQ, error } = await sb
  .from('questions')
  .select('question_id, source, section, question_text, answer_choices, correct_answer, passage_id, tags, difficulty');

if (error) { console.error('Fetch failed:', error); process.exit(1); }
console.log(`Loaded ${allQ.length} total questions.\n`);

// Filter to serveable only
const serveable = allQ.filter(q => {
  const tags = Array.isArray(q.tags) ? q.tags : [];
  return !tags.includes('formatting_issues') && !tags.includes('has_figure');
});
console.log(`Serveable (no formatting_issues, no has_figure): ${serveable.length}\n`);
console.log('='.repeat(70));

// ── Helper ──────────────────────────────────────────────────────────────────
function show(questions, { label, detail }) {
  console.log(`\n### ${label}`);
  console.log(`Total: ${questions.length}`);
  if (questions.length === 0) { console.log('  (none)'); return; }
  const sample = questions.slice(0, 6);
  sample.forEach(q => {
    console.log(`  [${q.source}] ${q.question_id}`);
    console.log(`    Q: ${String(q.question_text).slice(0, 120).replace(/\n/g, '↵')}`);
    if (detail) console.log(`    ${detail(q)}`);
  });
  if (questions.length > 6) console.log(`  … and ${questions.length - 6} more`);
}

// ── Check 1: Missing parenthesis content ────────────────────────────────────
// "( +" "( -" "( ×" "( ÷" "( =" suggest a number/expression was lost before the operator
const missingParenContent = serveable.filter(q => {
  const text = (q.question_text || '') + ' ' + Object.values(q.answer_choices || {}).join(' ');
  return /\(\s*[+\-×÷=<>]/.test(text) || /\(\s*\)/.test(text);
});
show(missingParenContent, {
  label: 'Check 1: Missing parenthesis content  ("( +" / "( )" patterns)',
  detail: q => {
    const text = (q.question_text || '') + ' | ' + Object.values(q.answer_choices || {}).join(' | ');
    const m = text.match(/[^\n]{0,30}\(\s*[+\-×÷=<>][^\n]{0,40}/);
    const m2 = text.match(/[^\n]{0,30}\(\s*\)[^\n]{0,40}/);
    return `Match: ${JSON.stringify((m || m2 || [''])[0])}`;
  },
});

// ── Check 2: Lost fraction bar (newline + standalone number/expression) ─────
// Pattern: text has a line that is ONLY a number or simple expression
// (e.g. a numerator on one line, denominator on next with the bar lost)
const lostFractionBar = serveable.filter(q => {
  const lines = (q.question_text || '').split('\n');
  return lines.some((line, i) => {
    const trimmed = line.trim();
    // A line that is purely a number, fraction, or short math expression (≤ 15 chars)
    // AND surrounded by other content lines
    if (i === 0 || i === lines.length - 1) return false;
    return /^[\d\s\+\-×÷=\/\(\)\.x]{1,15}$/.test(trimmed) && trimmed.length > 0;
  });
});
show(lostFractionBar, {
  label: 'Check 2: Likely lost fraction bar (isolated short expression on its own line)',
  detail: q => {
    const lines = (q.question_text || '').split('\n');
    const bad = lines.filter((l, i) => i > 0 && i < lines.length - 1 && /^[\d\s\+\-×÷=\/\(\)\.x]{1,15}$/.test(l.trim()) && l.trim().length > 0);
    return `Isolated lines: ${JSON.stringify(bad)}`;
  },
});

// ── Check 3: Truncated question text (< 20 chars) ───────────────────────────
const tooShort = serveable.filter(q => (q.question_text || '').trim().length < 20);
show(tooShort, {
  label: 'Check 3: Truncated question text (< 20 chars)',
  detail: q => `Full text: ${JSON.stringify(q.question_text)}  choices: ${JSON.stringify(q.answer_choices)}`,
});

// ── Check 4: Identical answer choices ───────────────────────────────────────
const identicalChoices = serveable.filter(q => {
  const vals = Object.values(q.answer_choices || {}).map(v => String(v).trim().toLowerCase());
  if (vals.length < 2) return false;
  return new Set(vals).size < vals.length;
});
show(identicalChoices, {
  label: 'Check 4: Identical answer choices (duplicate values)',
  detail: q => `Choices: ${JSON.stringify(q.answer_choices)}`,
});

// ── Check 5: All choices are a single character ──────────────────────────────
// Normal SAT choices are phrases or expressions; single-char choices suggest parse failure
const singleCharChoices = serveable.filter(q => {
  const vals = Object.values(q.answer_choices || {});
  if (vals.length < 3) return false; // grid-in or incomplete — caught elsewhere
  return vals.every(v => String(v).trim().length <= 1);
});
show(singleCharChoices, {
  label: 'Check 5: All answer choices are single characters (likely parse failure)',
  detail: q => `Choices: ${JSON.stringify(q.answer_choices)}`,
});

// ── Check 6: "None / All of the above" ──────────────────────────────────────
const noneAbove = serveable.filter(q => {
  const vals = Object.values(q.answer_choices || {}).join(' ').toLowerCase();
  return vals.includes('none of the above') || vals.includes('all of the above') || vals.includes('cannot be determined');
});
show(noneAbove, {
  label: 'Check 6: Non-SAT answer choices ("None of the above" / "All of the above")',
  detail: q => `Choices: ${JSON.stringify(q.answer_choices)}`,
});

// ── Check 7: Placeholder / lorem text ───────────────────────────────────────
const placeholder = serveable.filter(q => {
  const text = (q.question_text || '').toLowerCase();
  const choices = Object.values(q.answer_choices || {}).join(' ').toLowerCase();
  return /\[blank\]|\btbd\b|lorem ipsum|xxx|placeholder|\[insert\]/.test(text + ' ' + choices);
});
show(placeholder, {
  label: 'Check 7: Placeholder or lorem text',
  detail: q => `Q: ${q.question_text?.slice(0, 120)}`,
});

// ── Check 8: Broken Unicode / garbled chars ──────────────────────────────────
// Unicode replacement char (U+FFFD), or unusual sequences from PDF extraction
const garbledUnicode = serveable.filter(q => {
  const text = (q.question_text || '') + Object.values(q.answer_choices || {}).join('');
  return /\uFFFD/.test(text) ||            // replacement char
    /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text) || // control chars (not \t \n \r)
    /â€|Ã©|Ã¨|Â°|â€™|â€œ|â€/.test(text);  // UTF-8 double-decoded mojibake
});
show(garbledUnicode, {
  label: 'Check 8: Broken Unicode / mojibake / control characters',
  detail: q => {
    const text = q.question_text || '';
    const m = text.match(/[^\x20-\x7E\n\r\t\u00A0-\uFFFC]{1,5}/);
    return `Sample bad chars: ${m ? JSON.stringify(m[0]) : 'in choices'}`;
  },
});

// ── Check 9: Empty or whitespace-only answer choices ────────────────────────
const emptyChoices = serveable.filter(q => {
  const vals = Object.values(q.answer_choices || {});
  if (vals.length === 0) return false; // grid-in
  return vals.some(v => String(v).trim().length === 0);
});
show(emptyChoices, {
  label: 'Check 9: Empty or whitespace-only answer choices',
  detail: q => `Choices: ${JSON.stringify(q.answer_choices)}`,
});

// ── Check 10: Stray markdown artifacts ──────────────────────────────────────
const markdownArtifacts = serveable.filter(q => {
  const text = q.question_text || '';
  return /^\s*#{1,3}\s/m.test(text) ||   // ## heading
    /^\s*---+\s*$/m.test(text) ||         // --- divider
    /\*\*[^*]+\*\*/.test(text) ||         // **bold**
    /`[^`]+`/.test(text);                 // `code`
});
show(markdownArtifacts, {
  label: 'Check 10: Stray markdown artifacts in question text',
  detail: q => {
    const text = q.question_text || '';
    const m = text.match(/#{1,3}\s[^\n]{0,40}|---+|`[^`]{0,30}`|\*\*[^*]{0,30}\*\*/);
    return `Artifact: ${JSON.stringify(m ? m[0] : '')}`;
  },
});

// ── Check 11: Non-standard answer choice keys ────────────────────────────────
const badKeys = serveable.filter(q => {
  const keys = Object.keys(q.answer_choices || {});
  if (keys.length === 0) return false;
  return keys.some(k => !/^[A-E]$/.test(k));
});
show(badKeys, {
  label: 'Check 11: Non-standard answer choice keys (not A–E)',
  detail: q => `Keys: ${JSON.stringify(Object.keys(q.answer_choices))}  Choices: ${JSON.stringify(q.answer_choices)}`,
});

// ── Check 12: MC questions with only 1 or 2 choices ─────────────────────────
const tooFewChoices = serveable.filter(q => {
  const vals = Object.values(q.answer_choices || {});
  return vals.length >= 1 && vals.length <= 2;
});
show(tooFewChoices, {
  label: 'Check 12: Multiple-choice questions with only 1–2 choices (incomplete parse)',
  detail: q => `Choices (${Object.keys(q.answer_choices).length}): ${JSON.stringify(q.answer_choices)}`,
});

// ── Check 13: Question text ends abruptly ───────────────────────────────────
// Last non-whitespace char is not a normal sentence-ending char, digit, letter, quote, or closing bracket
const abruptEnding = serveable.filter(q => {
  const text = (q.question_text || '').trimEnd();
  if (text.length < 30) return false; // caught by truncation check
  const last = text[text.length - 1];
  return /[,;:\-–—+×÷=<>~@#$%^&*\\|{[\u2026]/.test(last);
});
show(abruptEnding, {
  label: 'Check 13: Question text ends abruptly (last char suggests truncation)',
  detail: q => {
    const text = (q.question_text || '').trimEnd();
    return `Ends with: ${JSON.stringify(text.slice(-40))}`;
  },
});

// ── Check 14: Duplicate question text ───────────────────────────────────────
const textMap = new Map();
for (const q of serveable) {
  const key = (q.question_text || '').trim().slice(0, 200).toLowerCase();
  if (!textMap.has(key)) textMap.set(key, []);
  textMap.get(key).push(q);
}
const duplicateText = [];
for (const [, group] of textMap) {
  if (group.length > 1) duplicateText.push(...group);
}
show(duplicateText, {
  label: 'Check 14: Duplicate question text across different question_ids',
  detail: q => `source: ${q.source}  id: ${q.question_id}`,
});

// ── Check 15: Math questions with a passage_id ───────────────────────────────
const mathWithPassage = serveable.filter(q => q.section === 'math' && q.passage_id);
show(mathWithPassage, {
  label: 'Check 15: Math questions with an attached passage (likely mis-classification)',
  detail: q => `passage_id: ${q.passage_id}  Q: ${(q.question_text || '').slice(0, 80)}`,
});

// ── Check 16: Answer choices that look like question text ────────────────────
// Very long answer choices (> 200 chars) suggest the parser put question content in choices
const longChoices = serveable.filter(q => {
  return Object.values(q.answer_choices || {}).some(v => String(v).length > 200);
});
show(longChoices, {
  label: 'Check 16: Suspiciously long answer choices (> 200 chars, may contain question text)',
  detail: q => {
    const worst = Object.entries(q.answer_choices || {}).sort((a, b) => b[1].length - a[1].length)[0];
    return `Key ${worst[0]} (${worst[1].length} chars): ${String(worst[1]).slice(0, 100)}`;
  },
});

// ── Check 17: Choices that are all numbers with no units/context ─────────────
// For R&W questions, choices should be words/phrases. If all are bare numbers, something's off.
const rwAllNumericChoices = serveable.filter(q => {
  if (q.section !== 'reading_writing') return false;
  const vals = Object.values(q.answer_choices || {});
  if (vals.length < 3) return false;
  return vals.every(v => /^\s*[\d\.\-\/]+\s*$/.test(String(v)));
});
show(rwAllNumericChoices, {
  label: 'Check 17: Reading & Writing questions with all-numeric answer choices',
  detail: q => `Choices: ${JSON.stringify(q.answer_choices)}  Q: ${(q.question_text || '').slice(0, 80)}`,
});

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));

const checks = [
  ['Check 1  Missing paren content',         missingParenContent.length],
  ['Check 2  Lost fraction bar',              lostFractionBar.length],
  ['Check 3  Truncated text (< 20 chars)',    tooShort.length],
  ['Check 4  Identical choices',             identicalChoices.length],
  ['Check 5  All single-char choices',        singleCharChoices.length],
  ['Check 6  Non-SAT choices',               noneAbove.length],
  ['Check 7  Placeholder text',              placeholder.length],
  ['Check 8  Broken Unicode / mojibake',     garbledUnicode.length],
  ['Check 9  Empty choices',                 emptyChoices.length],
  ['Check 10 Markdown artifacts',            markdownArtifacts.length],
  ['Check 11 Non-standard keys',             badKeys.length],
  ['Check 12 Too few choices (1–2)',          tooFewChoices.length],
  ['Check 13 Abrupt ending',                 abruptEnding.length],
  ['Check 14 Duplicate question text',        duplicateText.length],
  ['Check 15 Math + passage',                mathWithPassage.length],
  ['Check 16 Long choices (> 200 chars)',     longChoices.length],
  ['Check 17 R&W all-numeric choices',       rwAllNumericChoices.length],
];

const totalFlagged = new Set([
  ...missingParenContent,
  ...lostFractionBar,
  ...tooShort,
  ...identicalChoices,
  ...singleCharChoices,
  ...noneAbove,
  ...placeholder,
  ...garbledUnicode,
  ...emptyChoices,
  ...markdownArtifacts,
  ...badKeys,
  ...tooFewChoices,
  ...abruptEnding,
  ...duplicateText,
  ...mathWithPassage,
  ...longChoices,
  ...rwAllNumericChoices,
].map(q => q.question_id)).size;

checks.forEach(([label, count]) => {
  const bar = count > 0 ? '⚠ ' : '✓ ';
  console.log(`  ${bar}${label.padEnd(40)} ${String(count).padStart(4)}`);
});
console.log();
console.log(`  Total serveable questions:  ${serveable.length}`);
console.log(`  Unique questions flagged:   ${totalFlagged}`);
console.log(`  Clean (no issues):          ${serveable.length - totalFlagged}`);
