import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { selectNextSubSkill, selectTargetDifficulty, selectQuestion } from '@/lib/question-selector';
import { calculateNewElo } from '@/lib/elo';
import type { SkillRating, SubSkillId, Question } from '@/types';

// GET: Fetch next question for adaptive session
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  const subSkillId = searchParams.get('subSkillId') as SubSkillId | null;
  const excludeIds = searchParams.get('excludeIds')?.split(',') || [];
  const isFrustrated = searchParams.get('isFrustrated') === 'true';
  const sessionMinutes = parseInt(searchParams.get('sessionMinutes') || '0');
  const questionsAnswered = parseInt(searchParams.get('questionsAnswered') || '0');
  const section = searchParams.get('section');

  const supabase = createSupabaseServerClient();

  // Direct fetch by question ID (used by review queue active mode)
  const questionId = searchParams.get('questionId');
  if (questionId) {
    const { data: question, error: qErr } = await supabase
      .from('questions')
      .select('*')
      .eq('question_id', questionId)
      // Apply the same exclusion filters used in study sessions so corrupted
      // or figure-only questions are never served even via direct ID lookup.
      .not('tags', 'cs', '{formatting_issues}')
      .not('tags', 'cs', '{has_figure}')
      .single();
    if (qErr || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }
    if (question.passage_id) {
      const { data: passage } = await supabase
        .from('passages')
        .select('*')
        .eq('passage_id', question.passage_id)
        .single();
      return NextResponse.json({ question, passage });
    }
    return NextResponse.json({ question });
  }

  // Fetch student's skill ratings and (at session start) recently answered questions in parallel
  let skillRatings: SkillRating[] = [];
  let recentlyAnsweredIds: string[] = [];

  if (studentId) {
    const fetchRatings = supabase.from('skill_ratings').select('*').eq('student_id', studentId);

    // At session start (no in-session answers yet), fetch recent attempts across all sessions
    // so we don't serve the same first question every time a new session begins
    const fetchRecent = excludeIds.length === 0
      ? supabase
          .from('question_attempts')
          .select('question_id')
          .eq('student_id', studentId)
          .order('attempted_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: null });

    const [ratingsResult, recentResult] = await Promise.all([fetchRatings, fetchRecent]);
    skillRatings = (ratingsResult.data || []) as SkillRating[];
    recentlyAnsweredIds = (recentResult.data || []).map((r: { question_id: string }) => r.question_id);
  }

  // Effective exclusions: in-session answered + recently seen across sessions
  const effectiveExcludeIds = [...new Set([...excludeIds, ...recentlyAnsweredIds])];

  // Determine which sub-skill to target
  let targetSkill: SubSkillId | null = subSkillId;
  if (!targetSkill) {
    targetSkill = selectNextSubSkill({
      skillRatings,
      dueForReview: [],
      sessionState: {
        questionsAnswered,
        sessionDurationMinutes: sessionMinutes,
        isFrustrated,
      },
      recentlyAnswered: excludeIds,
    });
  }

  if (!targetSkill) {
    return NextResponse.json({ error: 'No skill available' }, { status: 404 });
  }

  // Get current Elo for this skill
  const currentRating = skillRatings.find(r => r.sub_skill_id === targetSkill);
  const currentElo = currentRating?.elo_rating || 1000;

  // Determine difficulty
  const targetDifficulty = selectTargetDifficulty({
    currentElo,
    isFrustrated,
    questionsAnswered,
    sessionDurationMinutes: sessionMinutes,
  });

  // Fetch candidate questions from DB (exclude formatting-issues and figure-only questions)
  let questionsQuery = supabase
    .from('questions')
    .select('*')
    .eq('sub_skill_id', targetSkill)
    .not('tags', 'cs', '{formatting_issues}')
    .not('tags', 'cs', '{has_figure}');

  if (section) {
    questionsQuery = questionsQuery.eq('section', section);
  }

  if (effectiveExcludeIds.length > 0) {
    questionsQuery = questionsQuery.not('question_id', 'in', `(${effectiveExcludeIds.join(',')})`);
  }

  const { data: questions, error } = await questionsQuery;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const selectedQuestion = selectQuestion({
    questions: (questions || []) as Question[],
    subSkillId: targetSkill,
    targetDifficulty,
    excludeIds: effectiveExcludeIds,
  });

  if (!selectedQuestion) {
    let fallbackQuery = supabase.from('questions').select('*');
    // Exclude questions with known formatting corruption or figure-only content
    fallbackQuery = fallbackQuery.not('tags', 'cs', '{formatting_issues}') as typeof fallbackQuery;
    fallbackQuery = fallbackQuery.not('tags', 'cs', '{has_figure}') as typeof fallbackQuery;

    if (section) {
      fallbackQuery = fallbackQuery.eq('section', section) as typeof fallbackQuery;
    }

    if (subSkillId) {
      // Explicit skill focus (Quick Drill): stay within the skill, recycle seen questions
      fallbackQuery = fallbackQuery.eq('sub_skill_id', subSkillId) as typeof fallbackQuery;
    } else {
      // Adaptive session: pick any unseen question across all skills
      if (effectiveExcludeIds.length > 0) {
        fallbackQuery = fallbackQuery.not('question_id', 'in', `(${effectiveExcludeIds.join(',')})`) as typeof fallbackQuery;
      }
    }

    const { data: fallbackQuestions } = await fallbackQuery.limit(20);

    if (!fallbackQuestions || fallbackQuestions.length === 0) {
      return NextResponse.json({ error: 'No questions available' }, { status: 404 });
    }

    const randomFallback = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)] as Question;
    if (randomFallback.passage_id) {
      const { data: passage } = await supabase
        .from('passages')
        .select('*')
        .eq('passage_id', randomFallback.passage_id)
        .single();
      return NextResponse.json({ question: randomFallback, passage, targetSkill, targetDifficulty });
    }
    return NextResponse.json({ question: randomFallback, targetSkill, targetDifficulty });
  }

  // Fetch passage if needed
  if (selectedQuestion.passage_id) {
    const { data: passage } = await supabase
      .from('passages')
      .select('*')
      .eq('passage_id', selectedQuestion.passage_id)
      .single();
    return NextResponse.json({ question: selectedQuestion, passage, targetSkill, targetDifficulty });
  }

  return NextResponse.json({ question: selectedQuestion, targetSkill, targetDifficulty });
}

// POST: Record a question attempt and update Elo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Accept both camelCase and snake_case
    const studentId: string = body.studentId ?? body.student_id;
    const sessionId: string = body.sessionId ?? body.session_id;
    const questionId: string = body.questionId ?? body.question_id;
    const studentAnswer: string = body.studentAnswer ?? body.student_answer;
    const isCorrect: boolean = body.isCorrect ?? body.is_correct;
    const timeSpentSeconds: number = body.timeSpentSeconds ?? body.time_spent_seconds ?? 0;
    const confidenceLevel: string | undefined = body.confidenceLevel ?? body.confidence_level;
    // User's local date (YYYY-MM-DD) sent by the client to avoid UTC-offset drift
    // in activity tracking and review scheduling. Falls back to UTC if missing.
    const localDate: string = body.local_date || new Date().toISOString().split('T')[0];

    const supabase = createSupabaseServerClient();

    // Record attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('question_attempts')
      .insert({
        student_id: studentId,
        session_id: sessionId,
        question_id: questionId,
        student_answer: studentAnswer,
        is_correct: isCorrect,
        time_spent_seconds: timeSpentSeconds,
        confidence_level: confidenceLevel,
      })
      .select()
      .single();

    if (attemptError) throw attemptError;

    // Fetch question for skill info
    const { data: question } = await supabase
      .from('questions')
      .select('sub_skill_id, difficulty')
      .eq('question_id', questionId)
      .single();

    if (question) {
      // Update Elo rating
      const { data: existingRating } = await supabase
        .from('skill_ratings')
        .select('*')
        .eq('student_id', studentId)
        .eq('sub_skill_id', question.sub_skill_id)
        .single();

      const currentElo = existingRating?.elo_rating || 1000;
      const questionsAttempted = existingRating?.questions_attempted || 0;

      const newElo = calculateNewElo({
        currentElo,
        questionDifficulty: question.difficulty as 1 | 2 | 3 | 4 | 5,
        isCorrect,
        questionsAttempted,
      });

      const newAttempted = questionsAttempted + 1;
      const newCorrect = (existingRating?.questions_correct || 0) + (isCorrect ? 1 : 0);

      await supabase
        .from('skill_ratings')
        .upsert({
          student_id: studentId,
          sub_skill_id: question.sub_skill_id,
          elo_rating: newElo,
          questions_attempted: newAttempted,
          questions_correct: newCorrect,
          is_calibrated: newAttempted >= 5,
          last_updated: new Date().toISOString(),
        }, { onConflict: 'student_id,sub_skill_id' });
    }

    // Update session stats
    const { data: session } = await supabase
      .from('sessions')
      .select('questions_answered, questions_correct')
      .eq('id', sessionId)
      .single();

    if (session) {
      const newAnswered = (session.questions_answered || 0) + 1;
      const newCorrect = (session.questions_correct || 0) + (isCorrect ? 1 : 0);
      await supabase
        .from('sessions')
        .update({
          questions_answered: newAnswered,
          questions_correct: newCorrect,
          accuracy: newCorrect / newAnswered,
        })
        .eq('id', sessionId);
    }

    // Update daily activity — read existing count first to correctly increment
    const { data: existingActivity } = await supabase
      .from('daily_activity')
      .select('questions_answered')
      .eq('student_id', studentId)
      .eq('activity_date', localDate)
      .maybeSingle();

    await supabase
      .from('daily_activity')
      .upsert({
        student_id: studentId,
        activity_date: localDate,
        questions_answered: (existingActivity?.questions_answered ?? 0) + 1,
        streak_qualifying: false,
      }, {
        onConflict: 'student_id,activity_date',
      });

    // Add wrong answer to review queue (SM-2)
    if (!isCorrect) {
      const [ly, lm, ld] = localDate.split('-').map(Number);
      const tomorrowDate = new Date(ly, lm - 1, ld + 1);
      const tomorrow = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;
      await supabase
        .from('review_queue')
        .upsert({
          student_id: studentId,
          question_id: questionId,
          next_review_date: tomorrow,
          review_count: 0,
          interval_days: 1,
        }, { onConflict: 'student_id,question_id' });
    }

    return NextResponse.json({ attempt, success: true });
  } catch (err) {
    console.error('questions POST:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
