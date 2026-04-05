/**
 * find-diagnostic-replacements.mjs
 *
 * Finds replacement candidates for 4 diagnostic question slots.
 * Filters: multiple choice only (non-empty answer_choices), no passage,
 * no quality tags, not a sub-skill already used in the other 6 slots.
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(process.cwd() + '/.env.local', 'utf-8').split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Sub-skills already locked in the diagnostic (the 6 keepers)
const LOCKED_SUB_SKILLS = new Set(['M-08', 'M-17', 'RW-03', 'RW-07', 'RW-09', 'RW-11', 'RW-05']);
// Sources already used (prefer variety)
const USED_SOURCES = new Set(['pt_11', 'seed_data', 'pt_8', 'pt_5', 'pt_4']);

// IDs being replaced (exclude from candidates)
const REPLACING = new Set([
  'q_pt_11_1772437672358_kz6',  // M-01 slot
  'q_pt_4_1772436228229_llr',   // M-04 slot
  'q_pt_8_1772437051105_ee1',   // M-11 slot
  'q_pt_5_1772436424291_5lt',   // M-17 slot (optional)
]);

const { data: pool, error } = await sb
  .from('questions')
  .select('question_id, sub_skill_id, difficulty, section, source, passage_id, tags, answer_choices, correct_answer')
  .eq('section', 'math')
  .is('passage_id', null)
  .not('tags', 'cs', '{formatting_issues}')
  .not('tags', 'cs', '{has_figure}');

if (error) { console.error(error); process.exit(1); }

// Multiple choice = answer_choices is a non-empty object with keys A/B/C/D
function isMultipleChoice(q) {
  if (!q.answer_choices) return false;
  const ac = q.answer_choices;
  if (typeof ac === 'object' && !Array.isArray(ac)) {
    return Object.keys(ac).length >= 2;
  }
  if (Array.isArray(ac)) return ac.length >= 2;
  return false;
}

const mc = pool.filter(q =>
  isMultipleChoice(q) &&
  !REPLACING.has(q.question_id) &&
  !LOCKED_SUB_SKILLS.has(q.sub_skill_id)
);

console.log(`Math pool: ${pool.length} total, ${mc.length} multiple-choice, serveable, no passage\n`);

function showCandidates(label, subSkills, difficulties) {
  console.log(`=== ${label} ===`);
  const candidates = mc.filter(q =>
    subSkills.includes(q.sub_skill_id) &&
    difficulties.includes(q.difficulty)
  );
  // Sort: prefer unused sources first, then by question_id
  candidates.sort((a, b) => {
    const aUsed = USED_SOURCES.has(a.source) ? 1 : 0;
    const bUsed = USED_SOURCES.has(b.source) ? 1 : 0;
    if (aUsed !== bUsed) return aUsed - bUsed;
    return a.question_id.localeCompare(b.question_id);
  });

  if (!candidates.length) {
    console.log('  ❌ No candidates found\n');
    return;
  }

  for (const q of candidates.slice(0, 8)) {
    const fresh = USED_SOURCES.has(q.source) ? '' : ' ★new-source';
    console.log(`  ${q.question_id}  sub=${q.sub_skill_id}  diff=${q.difficulty}  source=${q.source}${fresh}`);
    // Show first 120 chars of the answer_choices to confirm it's real MC
    const preview = JSON.stringify(q.answer_choices).slice(0, 100);
    console.log(`    choices: ${preview}`);
  }
  console.log(`  (${candidates.length} total candidates)\n`);
}

// Slot 1: M-01 or M-02, diff 3 (replacing M-01)
// M-01 is NOT in LOCKED_SUB_SKILLS so we can keep it; M-02 also fine
showCandidates('Slot 1 — M-01 or M-02, diff 3 (replacing corrupted M-01)',
  ['M-01', 'M-02'], [3]);

// Slot 3: M-11, diff 3 (replacing grid-in M-11)
// M-11 not in locked set
showCandidates('Slot 3 — M-11, diff 3, multiple choice (replacing grid-in)',
  ['M-11'], [3]);

// Slot 4: M-16/M-17/M-18/M-19, diff 2 (replacing grid-in M-17, optional)
// M-17 NOT in locked set (it's the one being replaced)
// But we need to also exclude M-17 if we already replaced it — treat as unlocked
showCandidates('Slot 4 — Geometry M-16–M-19, diff 2, multiple choice (replacing grid-in M-17, optional)',
  ['M-16', 'M-17', 'M-18', 'M-19'], [2]);

// Slot 5: M-04, diff 3 or 4, self-contained (replacing context-lost M-04)
showCandidates('Slot 5 — M-04, diff 3 or 4 (replacing context-lost Systems question)',
  ['M-04'], [3, 4]);
