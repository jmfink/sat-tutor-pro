import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question_id, student_id, feedback_type, notes } = body;

    if (!question_id || !student_id || !feedback_type) {
      return NextResponse.json({ error: 'question_id, student_id, and feedback_type are required' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('question_feedback')
      .insert({ question_id, student_id, feedback_type, notes: notes ?? null })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') ?? '50');

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('question_feedback')
    .select('*, questions(question_id, question_text, section, sub_skill_id, difficulty)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
