import { NextRequest, NextResponse } from 'next/server';
import { generateSessionSummary } from '@/lib/claude';
import { createSupabaseServerClient } from '@/lib/supabase';
import type { StudentContextProfile } from '@/types';

const MATH_PACING_THRESHOLD_S = 90;
const RW_PACING_THRESHOLD_S = 75;

interface PacingFlag {
  questionNum: number;
  section: string;
  timeSpentSeconds: number;
  isCorrect: boolean;
  isTimeSink: boolean; // slow AND wrong
}

function computePacingAnalysis(attempts: Record<string, unknown>[]): {
  flags: PacingFlag[];
  timeSinks: PacingFlag[];
  summary: string | null;
} {
  const flags: PacingFlag[] = [];

  attempts.forEach((attempt, idx) => {
    const q = attempt.questions as Record<string, unknown> | null;
    const section = (q?.section as string) ?? 'math';
    const threshold = section === 'math' ? MATH_PACING_THRESHOLD_S : RW_PACING_THRESHOLD_S;
    const timeSpent = (attempt.time_spent_seconds as number) ?? 0;

    if (timeSpent > threshold) {
      flags.push({
        questionNum: idx + 1,
        section,
        timeSpentSeconds: timeSpent,
        isCorrect: Boolean(attempt.is_correct),
        isTimeSink: !attempt.is_correct,
      });
    }
  });

  const timeSinks = flags.filter((f) => f.isTimeSink);

  if (flags.length === 0) return { flags, timeSinks, summary: null };

  const threshold = (section: string) =>
    section === 'math' ? MATH_PACING_THRESHOLD_S : RW_PACING_THRESHOLD_S;

  const sinkDescriptions = timeSinks
    .slice(0, 3)
    .map((f) => {
      const mins = Math.floor(f.timeSpentSeconds / 60);
      const secs = f.timeSpentSeconds % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      return `question ${f.questionNum} (${timeStr}, wrong — threshold: ${threshold(f.section)}s)`;
    })
    .join('; ');

  const slowDescriptions = flags
    .filter((f) => f.isCorrect)
    .slice(0, 2)
    .map((f) => {
      const mins = Math.floor(f.timeSpentSeconds / 60);
      const secs = f.timeSpentSeconds % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      return `question ${f.questionNum} (${timeStr}, correct)`;
    })
    .join('; ');

  const parts: string[] = [];
  if (timeSinks.length > 0) parts.push(`Time sinks (slow + wrong): ${sinkDescriptions}`);
  if (slowDescriptions) parts.push(`Slow but correct: ${slowDescriptions}`);

  return {
    flags,
    timeSinks,
    summary: parts.join(' | '),
  };
}

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

    // Compute pacing analysis from attempt timing data
    const pacingAnalysis = computePacingAnalysis(attempts || []);

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
      pacing_analysis: pacingAnalysis.summary ?? 'No pacing issues detected.',
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

    return NextResponse.json({ summary, pacingFlags: pacingAnalysis.flags, timeSinks: pacingAnalysis.timeSinks });
  } catch (err) {
    console.error('session-summary:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
