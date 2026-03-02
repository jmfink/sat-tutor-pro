import { NextRequest, NextResponse } from 'next/server';
import { generateSessionSummary } from '@/lib/claude';
import { createSupabaseServerClient } from '@/lib/supabase';
import type { StudentContextProfile } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id: sessionId, student_id: studentId } = body;

    const supabase = createSupabaseServerClient();

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    // Fetch attempts, skill ratings, and score prediction in parallel
    const [{ data: attempts }, , { data: scorePred }] = await Promise.all([
      supabase
        .from('question_attempts')
        .select('*, questions(*)')
        .eq('session_id', sessionId),
      supabase
        .from('skill_ratings')
        .select('*')
        .eq('student_id', studentId),
      supabase
        .from('score_predictions')
        .select('*')
        .eq('student_id', studentId)
        .order('predicted_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

    const studentProfile: Partial<StudentContextProfile> = {
      student_id: studentId,
      session_number: 1,
      current_predicted_score: {
        total: scorePred?.total_score_mid || 1100,
        rw: scorePred?.rw_score || 550,
        math: scorePred?.math_score || 550,
      },
      skill_ratings: {} as StudentContextProfile['skill_ratings'],
    };

    // Format started_at as a local date string so Claude references the
    // correct local date rather than a raw UTC timestamp.
    const sessionForClaude = {
      ...session,
      started_at: new Date(session.started_at).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const summary = await generateSessionSummary({
      session: sessionForClaude,
      attempts: attempts || [],
      studentProfile: studentProfile as StudentContextProfile,
    });

    // Update session with summary and mark ended
    await supabase
      .from('sessions')
      .update({ summary, ended_at: new Date().toISOString() })
      .eq('id', sessionId);

    return NextResponse.json({ summary });
  } catch (err) {
    console.error('session-summary:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
