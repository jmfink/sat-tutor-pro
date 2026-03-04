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

const { data } = await sb.from('questions').select('source, section');
const counts = {};
const sections = {};
(data || []).forEach(r => {
  counts[r.source] = (counts[r.source] || 0) + 1;
  if (!sections[r.source]) sections[r.source] = {};
  sections[r.source][r.section] = (sections[r.source][r.section] || 0) + 1;
});
console.log('Sources:', JSON.stringify(counts, null, 2));
console.log('By section:', JSON.stringify(sections, null, 2));
