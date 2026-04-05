/**
 * Shared logic for fetching and building the Tutor Update report payload.
 * Used by both the public API route and the SSR report page.
 */

import { createSupabaseAdminClient } from '@/lib/supabase';
import { SUB_SKILL_MAP } from '@/lib/constants';
import type { SubSkillId } from '@/types';

// Generic one-line pattern notes for each sub-skill
const SKILL_PATTERN_NOTES: Record<string, string> = {
  'RW-01': 'Struggles to identify the main idea and supporting details',
  'RW-02': 'Difficulty using textual evidence to support answers',
  'RW-03': 'Challenged by data in graphs and charts alongside text',
  'RW-04': 'Makes inferences beyond what the passage directly supports',
  'RW-05': 'Confused by words used in non-standard or figurative ways',
  'RW-06': 'Misidentifies how texts are organized or their purpose',
  'RW-07': 'Struggles to compare ideas or arguments across two texts',
  'RW-08': 'Difficulty combining information for rhetorical goals',
  'RW-09': 'Selects inappropriate transition words between ideas',
  'RW-10': 'Makes sentence boundary errors (run-ons, fragments)',
  'RW-11': 'Confused by pronoun agreement, verb tense, or modifier placement',
  'M-01': 'Makes setup errors on single-variable linear equations',
  'M-02': 'Struggles to represent relationships with two-variable equations',
  'M-03': 'Difficulty interpreting slope, intercepts, and function behavior',
  'M-04': 'Errors in solving systems — substitution or elimination mistakes',
  'M-05': 'Misapplies inequality rules, especially with negatives',
  'M-06': 'Confused by nonlinear function behavior and transformations',
  'M-07': 'Struggles to rewrite or factor equivalent algebraic expressions',
  'M-08': 'Errors on quadratic equations — factoring or quadratic formula',
  'M-09': 'Misunderstands exponential growth/decay and percentage change',
  'M-10': 'Makes proportional reasoning errors, especially with unit rates',
  'M-11': 'Struggles with percent change and percent of a whole',
  'M-12': 'Misinterprets mean, median, and spread from data sets',
  'M-13': 'Difficulty reading scatterplots and lines of best fit',
  'M-14': 'Confuses probability rules and conditional probability',
  'M-15': 'Misapplies statistical inference and margin of error concepts',
  'M-16': 'Makes formula substitution errors on area and volume problems',
  'M-17': 'Struggles with angle relationships, parallel lines, triangle rules',
  'M-18': 'Confuses SOHCAHTOA and right triangle relationships',
  'M-19': 'Makes arc/sector errors or confuses circle equation forms',
};

export interface TutorReportWeakSkill {
  sub_skill_id: string;
  name: string;
  accuracy: number;
  trend: 'up' | 'down' | 'flat';
  pattern_note: string;
}

export interface TutorReportTrendingSkill {
  sub_skill_id: string;
  name: string;
  accuracy_before: number;
  accuracy_after: number;
  delta: number;
}

export interface TutorReportTopInsight {
  finding: string;
  recommendation: string;
  severity: string;
}

export interface TutorReportData {
  student_first_name: string;
  week_of: string;
  predicted_score: number | null;
  score_delta_4w: number | null;
  rw_score: number | null;
  math_score: number | null;
  days_practiced: number;
  questions_this_week: number;
  weak_skills: TutorReportWeakSkill[];
  trending_up: TutorReportTrendingSkill[];
  top_insight: TutorReportTopInsight | null;
}

export type FetchTutorReportResult =
  | { status: 404 }
  | { status: 410 }
  | { status: 200; data: TutorReportData };

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

function getWeekOfLabel(): string {
  const [year, month, day] = getWeekStart().split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

export async function fetchTutorReport(token: string): Promise<FetchTutorReportResult> {
  const admin = createSupabaseAdminClient();

  // Fetch and validate the link
  const { data: link } = await admin
    .from('tutor_share_links')
    .select('id, student_id, expires_at, view_count')
    .eq('token', token)
    .single();

  if (!link) return { status: 404 };
  if (new Date(link.expires_at) < new Date()) return { status: 410 };

  // Increment view count
  await admin
    .from('tutor_share_links')
    .update({ view_count: (link.view_count ?? 0) + 1 })
    .eq('id', link.id);

  const studentId = link.student_id;
  const weekStart = getWeekStart();
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  // Fetch all data in parallel
  const [
    { data: student },
    { data: latestPred },
    { data: oldPred },
    { data: weekActivity },
    { data: skillRatings },
    { data: recentAttempts },
    { data: latestInsight },
  ] = await Promise.all([
    admin.from('students').select('name').eq('id', studentId).single(),

    admin
      .from('score_predictions')
      .select('total_score_mid, rw_score, math_score')
      .eq('student_id', studentId)
      .order('predicted_at', { ascending: false })
      .limit(1)
      .single(),

    admin
      .from('score_predictions')
      .select('total_score_mid')
      .eq('student_id', studentId)
      .lt('predicted_at', fourWeeksAgo.toISOString())
      .order('predicted_at', { ascending: false })
      .limit(1)
      .single(),

    admin
      .from('daily_activity')
      .select('activity_date, questions_answered')
      .eq('student_id', studentId)
      .gte('activity_date', weekStart),

    admin
      .from('skill_ratings')
      .select('sub_skill_id, elo_rating, questions_attempted, questions_correct')
      .eq('student_id', studentId),

    admin
      .from('question_attempts')
      .select('sub_skill_id, is_correct, attempted_at')
      .eq('student_id', studentId)
      .order('attempted_at', { ascending: false })
      .limit(300),

    admin
      .from('wrong_answer_insights')
      .select('top_insights, dimension_details')
      .eq('student_id', studentId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single(),
  ]);

  const firstName = (student?.name ?? 'Student').split(' ')[0];
  const predictedScore = latestPred?.total_score_mid ?? null;
  const scoreDelta4w =
    predictedScore !== null && oldPred?.total_score_mid != null
      ? predictedScore - oldPred.total_score_mid
      : null;
  const daysPracticed = weekActivity?.length ?? 0;
  const questionsThisWeek = weekActivity?.reduce((s, d) => s + (d.questions_answered ?? 0), 0) ?? 0;

  // ── Build skill attempt map for trend analysis ────────────────────────────
  // recentAttempts is sorted DESC (most recent first)
  const skillAttemptMap: Record<string, { is_correct: boolean }[]> = {};
  for (const a of recentAttempts ?? []) {
    if (!skillAttemptMap[a.sub_skill_id]) skillAttemptMap[a.sub_skill_id] = [];
    skillAttemptMap[a.sub_skill_id].push({ is_correct: a.is_correct });
  }

  function getTrend(skillId: string): 'up' | 'down' | 'flat' {
    const attempts = skillAttemptMap[skillId] ?? [];
    if (attempts.length < 6) return 'flat';
    const recent = attempts.slice(0, Math.ceil(attempts.length / 2));
    const older = attempts.slice(Math.ceil(attempts.length / 2));
    if (older.length < 3) return 'flat';
    const recentAcc = recent.filter((a) => a.is_correct).length / recent.length;
    const olderAcc = older.filter((a) => a.is_correct).length / older.length;
    if (recentAcc > olderAcc + 0.1) return 'up';
    if (recentAcc < olderAcc - 0.1) return 'down';
    return 'flat';
  }

  // ── Top 3 weak skills (lowest accuracy, >= 5 attempts) ───────────────────
  const weakSkills: TutorReportWeakSkill[] = (skillRatings ?? [])
    .filter((r) => r.questions_attempted >= 5)
    .map((r) => ({
      sub_skill_id: r.sub_skill_id,
      name: SUB_SKILL_MAP[r.sub_skill_id as SubSkillId]?.name ?? r.sub_skill_id,
      accuracy: Math.round((r.questions_correct / r.questions_attempted) * 100),
      trend: getTrend(r.sub_skill_id),
      pattern_note: SKILL_PATTERN_NOTES[r.sub_skill_id] ?? 'Needs targeted practice',
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  // ── Top 3 trending up (positive accuracy delta, not in weak list) ─────────
  const weakIds = new Set(weakSkills.map((s) => s.sub_skill_id));

  const trendingUp: TutorReportTrendingSkill[] = (skillRatings ?? [])
    .filter((r) => r.questions_attempted >= 10 && !weakIds.has(r.sub_skill_id))
    .flatMap((r) => {
      const attempts = skillAttemptMap[r.sub_skill_id] ?? [];
      if (attempts.length < 6) return [];
      const mid = Math.ceil(attempts.length / 2);
      const recent = attempts.slice(0, mid);
      const older = attempts.slice(mid);
      if (older.length < 3) return [];
      const recentAcc = Math.round((recent.filter((a) => a.is_correct).length / recent.length) * 100);
      const olderAcc = Math.round((older.filter((a) => a.is_correct).length / older.length) * 100);
      const delta = recentAcc - olderAcc;
      if (delta <= 0) return [];
      return [{
        sub_skill_id: r.sub_skill_id,
        name: SUB_SKILL_MAP[r.sub_skill_id as SubSkillId]?.name ?? r.sub_skill_id,
        accuracy_before: olderAcc,
        accuracy_after: recentAcc,
        delta,
      }];
    })
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);

  // ── Top insight from wrong_answer_insights ────────────────────────────────
  let topInsight: TutorReportTopInsight | null = null;
  if (latestInsight?.top_insights && Array.isArray(latestInsight.top_insights) && latestInsight.top_insights.length > 0) {
    const first = latestInsight.top_insights[0];
    topInsight = {
      finding: first.finding ?? '',
      recommendation: first.recommendation ?? '',
      severity: first.severity ?? 'medium',
    };
  }

  return {
    status: 200,
    data: {
      student_first_name: firstName,
      week_of: getWeekOfLabel(),
      predicted_score: predictedScore,
      score_delta_4w: scoreDelta4w,
      rw_score: latestPred?.rw_score ?? null,
      math_score: latestPred?.math_score ?? null,
      days_practiced: daysPracticed,
      questions_this_week: questionsThisWeek,
      weak_skills: weakSkills,
      trending_up: trendingUp,
      top_insight: topInsight,
    },
  };
}
