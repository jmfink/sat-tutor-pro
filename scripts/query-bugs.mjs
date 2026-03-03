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

// Bug 3: questions with 'Graph A', 'Graph B' type answer choices not yet has_figure tagged
const { data: allQ } = await sb.from('questions')
  .select('question_id, question_text, answer_choices, section, tags');

const graphMatches = (allQ || []).filter(q => {
  const tags = Array.isArray(q.tags) ? q.tags : [];
  if (tags.includes('has_figure')) return false;
  const choices = Object.values(q.answer_choices || {}).join(' ').toLowerCase();
  return choices.includes('graph a') || choices.includes('graph b') || choices.includes('graph c') || choices.includes('graph d');
});
console.log('=== BUG 3: Graph A/B/C/D in choices (not yet has_figure tagged) ===');
graphMatches.forEach(q => {
  console.log('  section:', q.section);
  console.log('  Q text:', q.question_text?.slice(0, 120));
  console.log('  choices:', JSON.stringify(q.answer_choices));
  console.log();
});
console.log('Total:', graphMatches.length);

// Bug 4: ^h corruption
const caretH = (allQ || []).filter(q => {
  const tags = Array.isArray(q.tags) ? q.tags : [];
  if (tags.includes('formatting_issues')) return false;
  return Object.values(q.answer_choices || {}).some(v => String(v).includes('^h'));
});
console.log('\n=== BUG 4: ^h corruption ===');
caretH.forEach(q => {
  console.log('  id:', q.question_id, 'choices:', JSON.stringify(q.answer_choices));
});
console.log('Total ^h questions:', caretH.length);

// Bug 5: correct_answer not in answer_choices keys (MC only)
const mismatch = (allQ || []).filter(q => {
  const tags = Array.isArray(q.tags) ? q.tags : [];
  if (tags.includes('formatting_issues')) return false;
  const choices = q.answer_choices || {};
  const keys = Object.keys(choices);
  if (keys.length === 0) return false; // grid-in
  return q.correct_answer && !choices[q.correct_answer];
});
console.log('\n=== BUG 5: correct_answer not in choices ===');
mismatch.slice(0, 8).forEach(q => {
  console.log('  id:', q.question_id, 'correct:', q.correct_answer, 'keys:', Object.keys(q.answer_choices));
});
console.log('Total mismatch questions:', mismatch.length);
