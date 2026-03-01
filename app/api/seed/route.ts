import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DEMO_STUDENT_ID } from '@/lib/constants';

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

// Seed demo student + sample questions
export async function POST(): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const supabase = createSupabaseServerClient();

    // Upsert demo student first (required by FK on sessions/skill_ratings)
    const { error: studentError } = await supabase
      .from('students')
      .upsert({
        id: DEMO_STUDENT_ID,
        name: 'Ethan',
        email: 'ethan@example.com',
        parent_email: 'parent@example.com',
        settings: {
          preferred_explanation_style: 'visual',
          socratic_mode: true,
        },
      }, { onConflict: 'id' });

    if (studentError) throw studentError;

    // Upsert seed questions
    const seedData = JSON.parse(
      readFileSync(join(process.cwd(), 'data/questions/seed-questions.json'), 'utf-8')
    );

    const { data, error: questionsError } = await supabase
      .from('questions')
      .upsert(seedData, { onConflict: 'question_id' })
      .select();

    if (questionsError) throw questionsError;

    return NextResponse.json({ student: DEMO_STUDENT_ID, seeded: data?.length || 0 });
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}
