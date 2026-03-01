import { NextRequest, NextResponse } from 'next/server';
import { classifyError } from '@/lib/claude';
import { createSupabaseServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, correctAnswer, studentAnswer, timeSpentSeconds, confidenceLevel, attemptId } = body;

    const result = await classifyError({
      question,
      correctAnswer,
      studentAnswer,
      timeSpentSeconds: timeSpentSeconds || 0,
      confidenceLevel: confidenceLevel || 'okay',
    });

    // Update the attempt in DB if attemptId provided
    if (attemptId) {
      const supabase = createSupabaseServerClient();
      await supabase
        .from('question_attempts')
        .update({
          error_type: result.error_type,
          distractor_type: result.distractor_type,
          error_explanation: result.explanation,
        })
        .eq('id', attemptId);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('classify-error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Batch classification endpoint
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { attempts } = body as { attempts: Array<{
      attemptId: string;
      question: Record<string, unknown>;
      correctAnswer: string;
      studentAnswer: string;
      timeSpentSeconds: number;
      confidenceLevel: string;
    }> };

    const results = await Promise.all(
      attempts.map(async (attempt) => {
        try {
          const result = await classifyError({
            question: attempt.question,
            correctAnswer: attempt.correctAnswer,
            studentAnswer: attempt.studentAnswer,
            timeSpentSeconds: attempt.timeSpentSeconds || 0,
            confidenceLevel: attempt.confidenceLevel || 'okay',
          });
          return { attemptId: attempt.attemptId, ...result };
        } catch {
          return { attemptId: attempt.attemptId, error: 'classification_failed' };
        }
      })
    );

    // Bulk update DB in parallel
    const supabase = createSupabaseServerClient();
    await Promise.all(
      results
        .filter((r) => !('error' in r) && !!r.attemptId)
        .map((r) => {
          const typed = r as { attemptId: string; error_type: string; distractor_type: string; explanation: string };
          return supabase
            .from('question_attempts')
            .update({
              error_type: typed.error_type,
              distractor_type: typed.distractor_type,
              error_explanation: typed.explanation,
            })
            .eq('id', typed.attemptId);
        })
    );

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
