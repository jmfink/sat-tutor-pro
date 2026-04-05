/**
 * select-diagnostic.mjs
 *
 * Selects 10 diagnostic questions meeting the onboarding criteria:
 *
 * Math (5):
 *   - Algebra (M-01–M-05), difficulty 3
 *   - Advanced Math (M-06–M-09), difficulty 4
 *   - Problem Solving & Data (M-10–M-15), difficulty 3
 *   - Geometry & Trig (M-16–M-19), difficulty 2
 *   - Any Math, difficulty 4–5
 *
 * R&W (5):
 *   - Information and Ideas (RW-01–RW-04), difficulty 3
 *   - Craft and Structure (RW-05–RW-08), difficulty 4
 *   - Expression of Ideas (RW-09), difficulty 2
 *   - Standard English Conventions (RW-10–RW-11), difficulty 3
 *   - Any R&W, difficulty 4
 *
 * Quality:
 *   - No formatting_issues or has_figure tags
 *   - passage_id must be null (no reading passages)
 *   - No duplicate sub-skills
 *   - Prefer variety across source tests
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(__dirname, '..', '.env.local'), 'utf-8').split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Fetch all serveable questions with no passage
const { data: pool, error } = await sb
  .from('questions')
  .select('question_id, sub_skill_id, difficulty, section, source, passage_id, tags')
  .is('passage_id', null)
  .not('tags', 'cs', '{formatting_issues}')
  .not('tags', 'cs', '{has_figure}');

if (error) { console.error('Query error:', error); process.exit(1); }

console.log(`Candidate pool (passage_id IS NULL, serveable): ${pool.length} questions\n`);

// Helper: pick one candidate from a filtered set, preferring sources not yet used
function pick(candidates, usedSubSkills, usedSources) {
  const eligible = candidates.filter(q => !usedSubSkills.has(q.sub_skill_id));
  if (!eligible.length) return null;
  // Prefer unused sources
  const fresh = eligible.filter(q => !usedSources.has(q.source));
  const set = fresh.length ? fresh : eligible;
  // Deterministic but varied: sort by question_id then pick middle to avoid always pt_4 first
  set.sort((a, b) => a.question_id.localeCompare(b.question_id));
  return set[Math.floor(set.length / 2)];
}

const slots = [
  // Math
  { label: 'Algebra (M-01–05), diff 3',            section: 'math', subSkills: ['M-01','M-02','M-03','M-04','M-05'], difficulty: 3 },
  { label: 'Advanced Math (M-06–09), diff 4',       section: 'math', subSkills: ['M-06','M-07','M-08','M-09'],       difficulty: 4 },
  { label: 'Problem Solving & Data (M-10–15), diff 3', section: 'math', subSkills: ['M-10','M-11','M-12','M-13','M-14','M-15'], difficulty: 3 },
  { label: 'Geometry & Trig (M-16–19), diff 2',    section: 'math', subSkills: ['M-16','M-17','M-18','M-19'],       difficulty: 2 },
  { label: 'Any Math, diff 4–5',                    section: 'math', subSkills: null, difficultyMin: 4, difficultyMax: 5 },
  // R&W
  { label: 'Information and Ideas (RW-01–04), diff 3', section: 'reading_writing', subSkills: ['RW-01','RW-02','RW-03','RW-04'], difficulty: 3 },
  { label: 'Craft and Structure (RW-05–08), diff 4',   section: 'reading_writing', subSkills: ['RW-05','RW-06','RW-07','RW-08'], difficulty: 4 },
  { label: 'Expression of Ideas (RW-09), diff 2',      section: 'reading_writing', subSkills: ['RW-09'],              difficulty: 2 },
  { label: 'Standard English Conv (RW-10–11), diff 3', section: 'reading_writing', subSkills: ['RW-10','RW-11'],      difficulty: 3 },
  { label: 'Any R&W, diff 4',                          section: 'reading_writing', subSkills: null, difficulty: 4 },
];

const selected = [];
const usedSubSkills = new Set();
const usedSources = new Set();

for (const slot of slots) {
  let candidates = pool.filter(q => q.section === slot.section);

  if (slot.subSkills) {
    candidates = candidates.filter(q => slot.subSkills.includes(q.sub_skill_id));
  }

  if (slot.difficulty !== undefined) {
    candidates = candidates.filter(q => q.difficulty === slot.difficulty);
  } else {
    candidates = candidates.filter(q => q.difficulty >= slot.difficultyMin && q.difficulty <= slot.difficultyMax);
  }

  const chosen = pick(candidates, usedSubSkills, usedSources);

  if (!chosen) {
    console.error(`❌ No candidate found for slot: ${slot.label}`);
    console.error(`   (${candidates.length} raw candidates, ${candidates.filter(q => !usedSubSkills.has(q.sub_skill_id)).length} after sub-skill dedup)`);
    process.exit(1);
  }

  usedSubSkills.add(chosen.sub_skill_id);
  usedSources.add(chosen.source);
  selected.push({ ...chosen, slot: slot.label, display_order: selected.length + 1 });

  console.log(`✓ [${selected.length}] ${slot.label}`);
  console.log(`    ${chosen.question_id}  sub_skill=${chosen.sub_skill_id}  diff=${chosen.difficulty}  source=${chosen.source}`);
}

console.log('\n--- JSON array ---');
console.log(JSON.stringify(selected.map(q => ({
  question_id: q.question_id,
  sub_skill_id: q.sub_skill_id,
  difficulty: q.difficulty,
  section: q.section,
  source: q.source,
  display_order: q.display_order,
})), null, 2));

console.log('\n--- Summary table ---');
console.log('Order | Section          | Sub-skill | Diff | Source  | Slot');
console.log('------+------------------+-----------+------+---------+' + '-'.repeat(45));
for (const q of selected) {
  const order  = String(q.display_order).padStart(5);
  const sec    = (q.section === 'math' ? 'Math' : 'R&W').padEnd(16);
  const ss     = q.sub_skill_id.padEnd(9);
  const diff   = String(q.difficulty).padStart(4);
  const src    = q.source.padEnd(7);
  console.log(`${order} | ${sec} | ${ss} | ${diff} | ${src} | ${q.slot}`);
}

const sourceDiversity = new Set(selected.map(q => q.source)).size;
console.log(`\nSource diversity: ${sourceDiversity} distinct source tests out of ${selected.length} questions`);
