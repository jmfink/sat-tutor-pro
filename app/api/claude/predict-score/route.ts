import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { predictScoreLocally } from '@/lib/score-predictor';
import type { SkillRating } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    // Fetch skill ratings
    const { data: skillRatings, error } = await supabase
      .from('skill_ratings')
      .select('*')
      .eq('student_id', studentId);

    if (error) throw error;

    // Use local prediction model
    const prediction = predictScoreLocally((skillRatings || []) as SkillRating[]);

    // Store prediction
    const { data: saved, error: insertError } = await supabase
      .from('score_predictions')
      .insert({
        student_id: studentId,
        total_score_low: prediction.total_score_low,
        total_score_mid: prediction.total_score_mid,
        total_score_high: prediction.total_score_high,
        rw_score: prediction.rw_score,
        math_score: prediction.math_score,
        confidence: prediction.confidence,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json(saved);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');

  if (!studentId) {
    return NextResponse.json({ error: 'studentId required' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('score_predictions')
    .select('*')
    .eq('student_id', studentId)
    .order('predicted_at', { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data || []);
}
