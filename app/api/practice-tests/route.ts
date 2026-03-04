import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createSupabaseServerClient();

  // Fetch all questions that belong to a pt_N source to count them
  const { data, error } = await supabase
    .from('questions')
    .select('source, section')
    .like('source', 'pt_%');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate counts per source
  const counts: Record<string, { total: number; math: number; reading_writing: number }> = {};
  for (const row of data ?? []) {
    if (!counts[row.source]) counts[row.source] = { total: 0, math: 0, reading_writing: 0 };
    counts[row.source].total++;
    counts[row.source][row.section as 'math' | 'reading_writing']++;
  }

  // Map pt_N → display metadata, sorted by test number
  const tests = Object.keys(counts)
    .sort((a, b) => {
      const na = parseInt(a.replace('pt_', ''), 10);
      const nb = parseInt(b.replace('pt_', ''), 10);
      return na - nb;
    })
    .map(source => {
      const num = source.replace('pt_', '');
      return {
        id: source,
        name: `College Board Practice Test ${num}`,
        questionCount: counts[source].total,
        mathCount: counts[source].math,
        rwCount: counts[source].reading_writing,
      };
    });

  return NextResponse.json(tests);
}
