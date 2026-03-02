/**
 * scripts/reparse-all-tests.mjs
 *
 * Re-parses all 8 College Board practice test bundles from the PDF files on
 * disk and inserts questions directly into the database, bypassing the browser
 * upload UI entirely.
 *
 * What it does:
 *   1. Deletes all existing uploaded_pdf / pt_N questions & their passages
 *   2. For each bundle (tests 4–11):
 *       a. Extracts text from the questions PDF and the scoring PDF
 *       b. Parses the answer key via regex (scoring PDF → no Claude needed)
 *       c. Parses questions via Claude, one module chunk at a time in parallel
 *       d. Merges correct_answer into each question row
 *       e. Deduplicates against the DB and against prior bundles in this run
 *       f. Classifies each question (sub_skill_id + difficulty) via Claude
 *       g. Inserts questions + passages into Supabase
 *       h. Reports per-bundle counts
 *   3. Runs scripts/audit-formatting.mjs --apply
 *   4. Runs scripts/tag-has-figure.mjs --apply
 *   5. Reports final totals by bundle and overall
 *
 * Run from the project root:
 *   node scripts/reparse-all-tests.mjs
 *
 * The source field for inserted questions is 'pt_N' (e.g. 'pt_4') so bundles
 * can be re-run individually. The deletion step clears both 'uploaded_pdf'
 * (legacy) and all 'pt_N' questions from previous runs.
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Load env from .env.local
// ---------------------------------------------------------------------------
const envPath = join(ROOT, '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { default: Anthropic } = await import('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const { extractText } = await import('unpdf');

// ---------------------------------------------------------------------------
// Sub-skill list (mirrors lib/constants.ts SUB_SKILLS)
// ---------------------------------------------------------------------------
const SUB_SKILLS = [
  { id: 'RW-01', name: 'Central Ideas & Details', section: 'reading_writing' },
  { id: 'RW-02', name: 'Command of Evidence (Textual)', section: 'reading_writing' },
  { id: 'RW-03', name: 'Command of Evidence (Quantitative)', section: 'reading_writing' },
  { id: 'RW-04', name: 'Inferences', section: 'reading_writing' },
  { id: 'RW-05', name: 'Words in Context', section: 'reading_writing' },
  { id: 'RW-06', name: 'Text Structure and Purpose', section: 'reading_writing' },
  { id: 'RW-07', name: 'Cross-Text Connections', section: 'reading_writing' },
  { id: 'RW-08', name: 'Rhetorical Synthesis', section: 'reading_writing' },
  { id: 'RW-09', name: 'Transitions', section: 'reading_writing' },
  { id: 'RW-10', name: 'Boundaries (Sentences)', section: 'reading_writing' },
  { id: 'RW-11', name: 'Form, Structure, and Sense', section: 'reading_writing' },
  { id: 'M-01', name: 'Linear Equations (one variable)', section: 'math' },
  { id: 'M-02', name: 'Linear Equations (two variables)', section: 'math' },
  { id: 'M-03', name: 'Linear Functions', section: 'math' },
  { id: 'M-04', name: 'Systems of Linear Equations', section: 'math' },
  { id: 'M-05', name: 'Linear Inequalities', section: 'math' },
  { id: 'M-06', name: 'Nonlinear Equations & Functions', section: 'math' },
  { id: 'M-07', name: 'Equivalent Expressions', section: 'math' },
  { id: 'M-08', name: 'Quadratics', section: 'math' },
  { id: 'M-09', name: 'Exponential Functions', section: 'math' },
  { id: 'M-10', name: 'Ratios, Rates, Proportions', section: 'math' },
  { id: 'M-11', name: 'Percentages', section: 'math' },
  { id: 'M-12', name: 'One-Variable Data (Statistics)', section: 'math' },
  { id: 'M-13', name: 'Two-Variable Data (Scatterplots)', section: 'math' },
  { id: 'M-14', name: 'Probability & Conditional Probability', section: 'math' },
  { id: 'M-15', name: 'Inference from Sample Statistics', section: 'math' },
  { id: 'M-16', name: 'Evaluating Claims', section: 'math' },
  { id: 'M-17', name: 'Area and Volume', section: 'math' },
  { id: 'M-18', name: 'Angles, Triangles, Trigonometry', section: 'math' },
  { id: 'M-19', name: 'Circles', section: 'math' },
];

const SUB_SKILL_LIST = SUB_SKILLS.map(s => `${s.id}: ${s.name} (${s.section})`).join('\n');

// ---------------------------------------------------------------------------
// Module layout (mirrors lib/claude.ts MODULE_META)
// ---------------------------------------------------------------------------
const MODULE_META = [
  { offset: 0,  count: 33, section: 'reading_writing' },
  { offset: 33, count: 33, section: 'reading_writing' },
  { offset: 66, count: 27, section: 'math' },
  { offset: 93, count: 27, section: 'math' },
];

// ---------------------------------------------------------------------------
// Passage keywords: R&W questions containing these but lacking passage_text
// are skipped (they reference a passage that wasn't extracted).
// ---------------------------------------------------------------------------
const PASSAGE_KEYWORDS = ['the passage', 'text 1', 'text 2', 'underlined'];

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Run fn on items in batches of batchSize, sequentially between batches. */
async function batchMap(items, fn, batchSize = 8) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      // brief pause between batches to stay within rate limits
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return results;
}

async function extractTextFromPDF(filePath) {
  const buf = readFileSync(filePath);
  const { text } = await extractText(new Uint8Array(buf));
  return text.map((page, i) => `--- Page ${i + 1} ---\n${page}`).join('\n');
}

// ---------------------------------------------------------------------------
// Answer key parser (mirrors lib/claude.ts parseAnswerKey)
// ---------------------------------------------------------------------------
function parseAnswerKey(text) {
  const results = [];
  const allBlocks = text.split(/QUESTION\s*#/i).slice(1);
  const hasSecondForm = allBlocks.length >= 8;
  const blocks = hasSecondForm ? allBlocks.slice(4, 8) : allBlocks.slice(0, 4);

  blocks.forEach((block, blockIdx) => {
    const meta = MODULE_META[blockIdx];
    if (!meta) return;
    const { offset, count, section } = meta;

    const lineRe = /^(\d+)\s+([A-D][\w./;: -]*)$/gm;
    let m;
    while ((m = lineRe.exec(block)) !== null) {
      const qn = parseInt(m[1]);
      if (qn < 1 || qn > count) continue;
      results.push({
        question_number: qn + offset,
        correct_answer: m[2].split(';')[0].trim(),
        section,
      });
    }

    const gridRe = /^(\d+)\s+(\.?\d[\d./;: -]*)$/gm;
    while ((m = gridRe.exec(block)) !== null) {
      const qn = parseInt(m[1]);
      if (qn < 1 || qn > count) continue;
      const globalQn = qn + offset;
      if (!results.find(r => r.question_number === globalQn)) {
        results.push({
          question_number: globalQn,
          correct_answer: m[2].split(';')[0].trim(),
          section,
        });
      }
    }
  });

  return results;
}

// ---------------------------------------------------------------------------
// Module boundary detection (mirrors lib/claude.ts detectModuleBoundaries)
// ---------------------------------------------------------------------------
function detectModuleBoundaries(text) {
  const boundaries = [];
  const QS = '\\d+ Q(?:UESTIONS| U E S T I O N S)';
  const rwRe   = new RegExp(`Reading and Writing\\n${QS}`, 'g');
  const mathRe = new RegExp(`Math\\n${QS}`, 'g');
  let m;
  while ((m = rwRe.exec(text)) !== null)   boundaries.push({ pos: m.index, section: 'reading_writing' });
  while ((m = mathRe.exec(text)) !== null) boundaries.push({ pos: m.index, section: 'math' });
  boundaries.sort((a, b) => a.pos - b.pos);

  const LOOKBACK = 3000;
  const adjustedStarts = boundaries.map((b, i) => {
    if (i === 0) return b.pos;
    const windowStart = Math.max(0, b.pos - LOOKBACK);
    const window = text.slice(windowStart, b.pos);
    const pageSepRe = /--- Page \d+ ---\n/g;
    let lastOffset = -1;
    let psm;
    while ((psm = pageSepRe.exec(window)) !== null) lastOffset = psm.index;
    return lastOffset === -1 ? b.pos : windowStart + lastOffset;
  });

  return boundaries.map((b, i) => ({
    start: adjustedStarts[i],
    end: adjustedStarts[i + 1] ?? text.length,
    section: b.section,
    offset: MODULE_META[i]?.offset ?? i * 33,
  }));
}

// ---------------------------------------------------------------------------
// Parse a single module chunk via Claude (mirrors lib/claude.ts parseQuestionChunk)
// ---------------------------------------------------------------------------
const PDF_PARSER_PROMPT = readFileSync(join(ROOT, 'prompts', 'pdf-parser.md'), 'utf-8');

async function parseQuestionChunk(chunkText, section, offset) {
  const userMessage =
    `Section: ${section}\nPDF Type: questions\n\n` +
    `PDF Text:\n${chunkText.slice(0, 40_000)}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16_000,
    system: PDF_PARSER_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]';
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }

  return parsed.map(q => ({
    ...q,
    question_number: (q.question_number ?? 0) + offset,
    section,
  }));
}

// ---------------------------------------------------------------------------
// Parse all questions in the questions PDF
// ---------------------------------------------------------------------------
async function parsePDFQuestions(pdfText) {
  const modules = detectModuleBoundaries(pdfText);
  if (modules.length === 0) {
    console.warn('  ⚠  No module boundaries detected — falling back to single-pass parse');
    return parseQuestionChunk(pdfText, 'reading_writing', 0);
  }

  // Parse all 4 modules in parallel
  const results = await Promise.all(
    modules.map(mod =>
      parseQuestionChunk(pdfText.slice(mod.start, mod.end), mod.section, mod.offset)
    )
  );

  return results.flat();
}

// ---------------------------------------------------------------------------
// Classify a single question via Claude
// ---------------------------------------------------------------------------
async function classifyQuestion(q) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      system: `Classify this SAT question. Return JSON only with:
{
  "sub_skill_id": "one of the sub-skill IDs listed",
  "difficulty": 1-5,
  "section": "math" or "reading_writing",
  "passage_type": null or "literary_fiction|social_science|natural_science|humanities"
}

Available sub-skills:
${SUB_SKILL_LIST}`,
      messages: [{ role: 'user', content: `Question: ${JSON.stringify(q)}` }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ...q, classification_error: 'no JSON' };
    const classification = JSON.parse(match[0]);
    return { ...q, ...classification };
  } catch (err) {
    return { ...q, classification_error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const PDF_DIR = resolve(homedir(), 'Documents', 'SAT Practice Tests');
const BUNDLES = [4, 5, 6, 7, 8, 9, 10, 11];
const SOURCE_NAMES = BUNDLES.map(n => `pt_${n}`);

// Track already-seen question_texts across all bundles to avoid cross-bundle dupes
const seenTexts = new Set();

const bundleStats = {};

console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log('║   SAT Tutor — Bulk Re-Parse All Practice Test PDFs    ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

// ---------------------------------------------------------------------------
// Step 1: Delete all existing uploaded_pdf + pt_N questions and passages
// ---------------------------------------------------------------------------
console.log('Step 1 — Deleting existing uploaded_pdf and pt_N questions…');

const sourcesToDelete = ['uploaded_pdf', ...SOURCE_NAMES];
const BATCH_SIZE = 400; // safe batch size for Supabase IN clause

// Collect all question_ids and passage_ids to delete
const { data: qRows } = await supabase
  .from('questions')
  .select('question_id, passage_id')
  .in('source', sourcesToDelete);

const idsToDelete = (qRows ?? []).map(r => r.question_id).filter(Boolean);
const orphanPassageIds = [...new Set(
  (qRows ?? []).map(r => r.passage_id).filter(Boolean)
)];

console.log(`  Found ${idsToDelete.length} questions to delete across sources: ${sourcesToDelete.join(', ')}`);

// Delete question_attempts first (FK: question_attempts.question_id → questions.question_id)
if (idsToDelete.length > 0) {
  let attemptsDeleted = 0;
  for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
    const batch = idsToDelete.slice(i, i + BATCH_SIZE);
    const { count } = await supabase
      .from('question_attempts')
      .delete({ count: 'exact' })
      .in('question_id', batch);
    attemptsDeleted += count ?? 0;
  }
  console.log(`  Deleted ${attemptsDeleted} question_attempts`);

  // Delete review_queue entries (FK: review_queue.question_id → questions.question_id)
  let reviewDeleted = 0;
  for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
    const batch = idsToDelete.slice(i, i + BATCH_SIZE);
    const { count } = await supabase
      .from('review_queue')
      .delete({ count: 'exact' })
      .in('question_id', batch);
    reviewDeleted += count ?? 0;
  }
  if (reviewDeleted > 0) console.log(`  Deleted ${reviewDeleted} review_queue entries`);
}

// Now delete questions (FK dependencies cleared)
let totalDeleted = 0;
for (const src of sourcesToDelete) {
  const { count, error } = await supabase
    .from('questions')
    .delete({ count: 'exact' })
    .eq('source', src);
  if (error) console.warn(`  Warning deleting source=${src}: ${error.message}`);
  else if (count) {
    totalDeleted += count;
    console.log(`  Deleted ${count} questions with source='${src}'`);
  }
}

// Delete associated passages (by collected passage_ids)
if (orphanPassageIds.length > 0) {
  for (let i = 0; i < orphanPassageIds.length; i += BATCH_SIZE) {
    const batch = orphanPassageIds.slice(i, i + BATCH_SIZE);
    await supabase.from('passages').delete().in('passage_id', batch);
  }
  console.log(`  Deleted ${orphanPassageIds.length} associated passages`);
}

// Belt-and-suspenders: also delete passages by source column
for (const src of ['uploaded_pdf', ...SOURCE_NAMES]) {
  await supabase.from('passages').delete().eq('source', src);
}

console.log(`\n  Total questions deleted: ${totalDeleted}\n`);

// Pre-populate seenTexts with all remaining question_texts (seed_data etc.)
const { data: existingRows } = await supabase
  .from('questions')
  .select('question_text');
for (const row of existingRows ?? []) {
  if (row.question_text) seenTexts.add(row.question_text);
}
console.log(`  ${seenTexts.size} existing question texts loaded for dedup.\n`);

// ---------------------------------------------------------------------------
// Step 2: Process each bundle
// ---------------------------------------------------------------------------
for (const testNum of BUNDLES) {
  const source = `pt_${testNum}`;
  const questionsPDF = join(PDF_DIR, `sat-practice-test-${testNum}-digital.pdf`);
  const scoringPDF   = join(PDF_DIR, `scoring-sat-practice-test-${testNum}-digital.pdf`);

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Bundle pt_${testNum} — Practice Test ${testNum}`);
  console.log('─'.repeat(60));

  bundleStats[testNum] = {
    parsed: 0, deduped: 0, classified: 0,
    inserted: 0, skipped_no_passage: 0, errors: 0,
  };
  const stats = bundleStats[testNum];

  // 2a. Extract text from PDFs
  console.log(`  Extracting text from PDFs…`);
  let questionsText, scoringText;
  try {
    [questionsText, scoringText] = await Promise.all([
      extractTextFromPDF(questionsPDF),
      extractTextFromPDF(scoringPDF),
    ]);
  } catch (err) {
    console.error(`  ✗ PDF extraction failed: ${err.message}`);
    continue;
  }
  console.log(`  Questions PDF: ${questionsText.length} chars | Scoring PDF: ${scoringText.length} chars`);

  // 2b. Parse answer key (regex, no Claude)
  console.log(`  Parsing answer key…`);
  const answerKey = parseAnswerKey(scoringText);
  const answersMap = new Map(answerKey.map(a => [a.question_number, a.correct_answer]));
  console.log(`  Answer key: ${answersMap.size} entries`);
  if (answersMap.size < 100) {
    console.warn(`  ⚠  Expected ~120 answers, got ${answersMap.size} — scoring PDF may be in an unexpected format`);
  }

  // 2c. Parse questions via Claude
  console.log(`  Parsing questions via Claude (4 modules in parallel)…`);
  let questions;
  try {
    questions = await parsePDFQuestions(questionsText);
  } catch (err) {
    console.error(`  ✗ Question parsing failed: ${err.message}`);
    continue;
  }
  stats.parsed = questions.length;
  console.log(`  Parsed: ${questions.length} questions`);

  // 2d. Merge correct_answer into each question
  questions = questions.map(q => ({
    ...q,
    correct_answer: answersMap.get(q.question_number) ?? q.correct_answer ?? '',
  }));

  const missingAnswers = questions.filter(q => !q.correct_answer).length;
  if (missingAnswers > 0) {
    console.warn(`  ⚠  ${missingAnswers} questions have no correct_answer after merge`);
  }

  // 2e. Deduplicate against global seen set
  const uniqueQuestions = [];
  for (const q of questions) {
    const text = typeof q.question_text === 'string' ? q.question_text : '';
    if (!text) continue;
    if (seenTexts.has(text)) {
      stats.deduped++;
      continue;
    }
    seenTexts.add(text);
    uniqueQuestions.push(q);
  }
  console.log(`  After dedup: ${uniqueQuestions.length} unique (${stats.deduped} dupes skipped)`);

  if (uniqueQuestions.length === 0) continue;

  // 2f. Filter R&W questions that reference passages but have no passage_text
  const questionsToClassify = uniqueQuestions.filter(q => {
    const section = q.section === 'math' ? 'math' : 'reading_writing';
    if (section === 'reading_writing' && !q.passage_text) {
      const lower = (q.question_text ?? '').toLowerCase();
      if (PASSAGE_KEYWORDS.some(kw => lower.includes(kw))) {
        stats.skipped_no_passage++;
        return false;
      }
    }
    return true;
  });

  if (stats.skipped_no_passage > 0) {
    console.log(`  Skipped ${stats.skipped_no_passage} R&W questions with missing passage_text`);
  }

  // 2g. Classify in batches (sub_skill_id + difficulty)
  console.log(`  Classifying ${questionsToClassify.length} questions via Claude (batches of 8)…`);
  const classified = await batchMap(questionsToClassify, classifyQuestion, 8);
  stats.classified = classified.length;
  console.log(`  Classification complete`);

  // 2h. Insert into DB
  console.log(`  Inserting into database…`);
  // Passage cache: passage_text → passage_id (avoid duplicate passage rows)
  const passageCache = new Map();

  for (const q of classified) {
    try {
      const section = q.section === 'math' ? 'math' : 'reading_writing';
      const questionText = q.question_text;
      if (!questionText) { stats.errors++; continue; }

      const rawDifficulty = Number(q.difficulty);
      const difficulty = Number.isFinite(rawDifficulty) && rawDifficulty >= 1 && rawDifficulty <= 5
        ? Math.round(rawDifficulty)
        : 3;

      const subSkillId = (q.sub_skill_id ?? '').trim() ||
        (section === 'math' ? 'M-01' : 'RW-01');

      const answerChoices = (q.answer_choices && typeof q.answer_choices === 'object')
        ? q.answer_choices
        : {};

      // Passage creation (with dedup within this bundle)
      let passageId = null;
      if (q.passage_text && typeof q.passage_text === 'string') {
        const passageText = q.passage_text;
        if (passageCache.has(passageText)) {
          passageId = passageCache.get(passageText);
        } else {
          const pid = `p_${source}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const { error: passErr } = await supabase.from('passages').insert({
            passage_id: pid,
            passage_text: passageText,
            source,
          });
          if (passErr) {
            console.warn(`    Passage insert error: ${passErr.message}`);
          } else {
            passageCache.set(passageText, pid);
            passageId = pid;
          }
        }
      }

      // Build tags: has_figure from parser output
      const hasFigure = q.has_figure === true || q.has_figure === 'true';
      const tags = hasFigure ? ['has_figure'] : [];

      const qid = `q_${source}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      const { error: qErr } = await supabase.from('questions').insert({
        question_id: qid,
        source,
        section,
        sub_skill_id: subSkillId,
        difficulty,
        question_text: questionText,
        passage_id: passageId,
        answer_choices: answerChoices,
        correct_answer: q.correct_answer ?? '',
        distractor_analysis: q.distractor_analysis || null,
        is_ai_generated: false,
        tags,
      });

      if (qErr) {
        stats.errors++;
        if (!qErr.message.includes('duplicate')) {
          console.warn(`    Insert error: ${qErr.message}`);
        }
      } else {
        stats.inserted++;
      }

    } catch (err) {
      stats.errors++;
      console.warn(`    Unexpected error: ${err.message}`);
    }
  }

  console.log(`  ✓ Bundle pt_${testNum} done: ${stats.inserted} inserted, ${stats.errors} errors`);
}

// ---------------------------------------------------------------------------
// Step 3: Run audit-formatting.mjs
// ---------------------------------------------------------------------------
console.log('\n' + '─'.repeat(60));
console.log('Step 3 — Running formatting audit (--apply)…');
try {
  execSync(`node ${join(__dirname, 'audit-formatting.mjs')} --apply`, {
    cwd: ROOT,
    stdio: 'inherit',
  });
} catch (err) {
  console.warn('  audit-formatting.mjs failed:', err.message);
}

// ---------------------------------------------------------------------------
// Step 4: Run tag-has-figure.mjs
// ---------------------------------------------------------------------------
console.log('\n' + '─'.repeat(60));
console.log('Step 4 — Running has_figure tagger (--apply)…');
try {
  execSync(`node ${join(__dirname, 'tag-has-figure.mjs')} --apply`, {
    cwd: ROOT,
    stdio: 'inherit',
  });
} catch (err) {
  console.warn('  tag-has-figure.mjs failed:', err.message);
}

// ---------------------------------------------------------------------------
// Step 5: Final report
// ---------------------------------------------------------------------------
console.log('\n' + '═'.repeat(60));
console.log('FINAL REPORT');
console.log('═'.repeat(60));
console.log(`${'Bundle'.padEnd(10)} ${'Parsed'.padStart(8)} ${'Dupes'.padStart(8)} ${'Inserted'.padStart(10)} ${'Errors'.padStart(8)}`);
console.log('─'.repeat(60));

let grandInserted = 0;
for (const n of BUNDLES) {
  const s = bundleStats[n] ?? {};
  const parsed   = s.parsed ?? 0;
  const deduped  = (s.deduped ?? 0) + (s.skipped_no_passage ?? 0);
  const inserted = s.inserted ?? 0;
  const errors   = s.errors ?? 0;
  grandInserted += inserted;
  console.log(`pt_${String(n).padEnd(7)} ${String(parsed).padStart(8)} ${String(deduped).padStart(8)} ${String(inserted).padStart(10)} ${String(errors).padStart(8)}`);
}

console.log('─'.repeat(60));
console.log(`${'TOTAL'.padEnd(10)} ${' '.repeat(16)} ${String(grandInserted).padStart(10)}`);
console.log('═'.repeat(60));

// Fetch final DB counts
const { count: finalCount } = await supabase
  .from('questions')
  .select('*', { count: 'exact', head: true });

const { count: figureCount } = await supabase
  .from('questions')
  .select('*', { count: 'exact', head: true })
  .contains('tags', ['has_figure']);

const { count: formattingCount } = await supabase
  .from('questions')
  .select('*', { count: 'exact', head: true })
  .contains('tags', ['formatting_issues']);

console.log(`\nDatabase totals after run:`);
console.log(`  Total questions       : ${finalCount}`);
console.log(`  Tagged has_figure     : ${figureCount}`);
console.log(`  Tagged formatting_issues : ${formattingCount}`);
console.log(`  Serveable questions   : ${finalCount - (figureCount ?? 0) - (formattingCount ?? 0)}`);
console.log('');
