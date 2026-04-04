import { NextRequest, NextResponse } from 'next/server';
import { analyzePatterns } from '@/lib/claude';
import { createSupabaseServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    // Fetch all wrong answers for the student
    const { data: attempts, error: attemptsError } = await supabase
      .from('question_attempts')
      .select(`
        *,
        questions (
          question_id, section, sub_skill_id, difficulty, question_text, answer_choices, correct_answer, distractor_analysis
        )
      `)
      .eq('student_id', studentId)
      .eq('is_correct', false)
      .order('attempted_at', { ascending: true });

    if (attemptsError) throw attemptsError;

    if (!attempts || attempts.length < 5) {
      return NextResponse.json({
        insufficient_data: true,
        wrong_answers_count: attempts?.length || 0,
        needed: 5,
      });
    }

    // Fetch previous insights
    const { data: prevInsights } = await supabase
      .from('wrong_answer_insights')
      .select('*')
      .eq('student_id', studentId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    // Run pattern analysis with Opus
    const analysis = await analyzePatterns({
      wrongAnswerHistory: attempts,
      previousInsights: prevInsights || null,
    });

    // Validate the analysis has the expected structure
    const topInsights = (analysis as { top_insights?: unknown }).top_insights;
    const dimensionDetails = (analysis as { dimension_details?: unknown }).dimension_details;

    if (!Array.isArray(topInsights) || typeof dimensionDetails !== 'object' || dimensionDetails === null) {
      console.error('analyze-patterns: Claude returned unexpected shape:', JSON.stringify(analysis).slice(0, 500));
      return NextResponse.json(
        { error: `Claude returned unexpected data format. Keys found: ${Object.keys(analysis).join(', ')}` },
        { status: 500 }
      );
    }

    // Store insights
    const { data: newInsight, error: insertError } = await supabase
      .from('wrong_answer_insights')
      .insert({
        student_id: studentId,
        total_wrong_answers_analyzed: attempts.length,
        top_insights: topInsights,
        dimension_details: dimensionDetails,
        raw_analysis: JSON.stringify(analysis),
      })
      .select()
      .single();

    if (insertError) throw insertError;
    if (!newInsight) throw new Error('Insert succeeded but no row returned — check RLS policies');

    return NextResponse.json({
      insight: newInsight,
      wrong_answers_count: attempts.length,
      threshold: 5,
    });
  } catch (err) {
    console.error('analyze-patterns:', err);
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
    .from('wrong_answer_insights')
    .select('*')
    .eq('student_id', studentId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also get wrong answer count
  const { count } = await supabase
    .from('question_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('is_correct', false);

  return NextResponse.json({
    insight: data || null,
    wrong_answers_count: count || 0,
    threshold: 5,
  });
}
