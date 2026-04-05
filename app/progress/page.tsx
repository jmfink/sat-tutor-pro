'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  Loader2,
  BookOpen,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StreakCounter } from '@/components/streak-counter';
import { SkillMap } from '@/components/skill-map';
import type {
  ScorePrediction,
  Session,
  DailyActivity,
  SkillRating,
  SubSkillId,
} from '@/types';
import { SUB_SKILL_MAP, SESSION_TYPE_LABELS, SESSION_TYPE_COLORS } from '@/lib/constants';
import { useAuth } from '@/components/auth-provider';
import { toLocalDateKey } from '@/lib/utils';
import { TutorUpdateButton } from '@/components/tutor-update-button';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const ERROR_PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

function SessionHistoryRow({ session }: { session: Session }) {
  const date = new Date(session.started_at);
  const hasAnswers = session.questions_answered > 0;
  const accuracy = hasAnswers
    ? Math.round((session.questions_correct / session.questions_answered) * 100)
    : null;
  const durationMs = session.ended_at
    ? new Date(session.ended_at).getTime() - date.getTime()
    : 0;
  const durationMin = Math.round(durationMs / 60000);

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="text-right shrink-0 w-14">
        <p className="text-xs font-semibold text-slate-700">
          {date.toLocaleDateString('default', { month: 'short', day: 'numeric' })}
        </p>
        <p className="text-[10px] text-slate-400">
          {date.toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <Badge variant="outline" className={`text-[10px] shrink-0 ${SESSION_TYPE_COLORS[session.session_type] ?? ''}`}>
            {SESSION_TYPE_LABELS[session.session_type] ?? session.session_type}
          </Badge>
          {durationMin > 0 && (
            <span className="text-xs text-slate-400">{durationMin} min</span>
          )}
          <div className="flex items-center gap-1 ml-auto">
            {accuracy !== null && (
              accuracy >= 80
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                : <XCircle className="h-3.5 w-3.5 text-red-400" />
            )}
            <span
              className={`text-sm font-bold ${
                accuracy === null
                  ? 'text-slate-400'
                  : accuracy >= 80 ? 'text-green-600' : accuracy >= 60 ? 'text-yellow-600' : 'text-red-600'
              }`}
            >
              {accuracy !== null ? `${accuracy}%` : '—'}
            </span>
          </div>
        </div>
        {session.summary ? (
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{session.summary}</p>
        ) : hasAnswers ? (
          <p className="text-xs text-slate-400">
            {session.questions_correct}/{session.questions_answered} correct
          </p>
        ) : (
          <p className="text-xs text-slate-400">No questions answered</p>
        )}
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const router = useRouter();
  const { userId } = useAuth();
  const [predictions, setPredictions] = useState<ScorePrediction[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [skillRatings, setSkillRatings] = useState<SkillRating[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<SubSkillId | null>(null);

  // Error distribution — no real data yet, placeholder until backend provides it
  const errorDist: { name: string; value: number }[] = [];

  useEffect(() => {
    Promise.all([
      // Score predictions history
      fetch(`/api/claude/predict-score?studentId=${userId ?? ''}&history=true`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => Array.isArray(data) ? data : [data].filter(Boolean))
        .catch(() => []),

      // Sessions
      fetch(`/api/sessions?studentId=${userId ?? ''}&limit=50`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => Array.isArray(data) ? data : data?.sessions ?? [])
        .catch(() => []),

      // Streak / activity — pass local date so streak counts in user's timezone
      fetch(`/api/sessions/streak?studentId=${userId ?? ''}&localDate=${toLocalDateKey()}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),

      // Skill ratings
      fetch(`/api/sessions?studentId=${userId ?? ''}&skillRatings=true`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([preds, sess, streakData, skillData]) => {
      setPredictions(preds);
      setSessions(sess);
      if (streakData) {
        setStreak(streakData.currentStreak ?? 0);
        setDailyActivity(streakData.dailyActivity ?? []);
      }
      if (skillData?.skill_ratings) setSkillRatings(skillData.skill_ratings);
    }).finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const selectedSkillData = selectedSkill ? SUB_SKILL_MAP[selectedSkill] : null;
  const selectedRating = skillRatings.find((r) => r.sub_skill_id === selectedSkill);
  const latestScore = predictions[0]?.total_score_mid ?? null;
  const totalQuestionsAnswered = sessions.reduce((sum, s) => sum + (s.questions_answered ?? 0), 0);
  const totalCorrect = sessions.reduce((sum, s) => sum + (s.questions_correct ?? 0), 0);
  const overallAccuracy = totalQuestionsAnswered > 0
    ? Math.round((totalCorrect / totalQuestionsAnswered) * 100)
    : null;

  return (
    <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">My Progress</h1>
          <p className="text-slate-500 text-sm mt-0.5">Your score and skill progress.</p>
        </div>
      </div>

      {/* Tutor Update */}
      <TutorUpdateButton />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-4 text-white shadow-sm">
          <p className="text-emerald-200 text-xs font-semibold uppercase tracking-wide mb-1">Predicted Score</p>
          <p className="text-3xl font-black">{latestScore ?? '—'}</p>
          <p className="text-emerald-200 text-xs mt-1">out of 1600</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1">Questions Answered</p>
          <p className="text-3xl font-black text-slate-900">{totalQuestionsAnswered.toLocaleString()}</p>
          <p className="text-slate-400 text-xs mt-1">across all sessions</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1">Overall Accuracy</p>
          <p className={`text-3xl font-black ${
            overallAccuracy === null ? 'text-slate-400'
            : overallAccuracy >= 80 ? 'text-green-600'
            : overallAccuracy >= 60 ? 'text-yellow-600'
            : 'text-red-600'
          }`}>{overallAccuracy !== null ? `${overallAccuracy}%` : '—'}</p>
          <p className="text-slate-400 text-xs mt-1">{totalQuestionsAnswered > 0 ? `${totalCorrect} correct` : 'No data yet'}</p>
        </div>
      </div>

      {/* Streak */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
          Study Streak
        </h2>
        <StreakCounter
          currentStreak={streak}
          dailyActivity={dailyActivity}
          weeklyGoal={5}
        />
      </div>

      {/* Skill map + selected skill detail */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
            Skill Map
          </h2>
          <Link
            href="/progress/skills"
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-0.5 no-underline"
          >
            Full skill tree <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <SkillMap
          skillRatings={skillRatings}
          onSkillClick={(skill) => setSelectedSkill(skill)}
        />

        {/* Selected skill detail panel */}
        {selectedSkill && selectedSkillData && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                    {selectedSkill}
                  </Badge>
                  <span className="text-xs text-slate-500">{selectedSkillData.domain}</span>
                </div>
                <p className="text-sm font-bold text-slate-900">{selectedSkillData.name}</p>
                {selectedRating && (
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
                    <span>ELO: <span className="font-bold">{selectedRating.elo_rating}</span></span>
                    <span>
                      Accuracy:{' '}
                      <span className="font-bold">
                        {selectedRating.questions_attempted > 0
                          ? Math.round((selectedRating.questions_correct / selectedRating.questions_attempted) * 100)
                          : 0}%
                      </span>
                    </span>
                    <span>Attempted: <span className="font-bold">{selectedRating.questions_attempted}</span></span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => router.push(`/study?subSkillId=${selectedSkill}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  Drill this skill
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedSkill(null)}
                  className="text-slate-500 text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom row: session history + error pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Session history */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
            Session History
          </h2>
          {sessions.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No sessions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {sessions.map((s, i) => (
                <SessionHistoryRow key={s.id ?? i} session={s} />
              ))}
            </div>
          )}
        </div>

        {/* Error type distribution */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
            Error Type Distribution
          </h2>
          {sessions.length === 0 || errorDist.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-slate-400 text-sm text-center">
                Error patterns will appear here after you&apos;ve answered some questions.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={errorDist}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ percent }) =>
                    (percent ?? 0) > 0.08 ? `${Math.round((percent ?? 0) * 100)}%` : ''
                  }
                >
                  {errorDist.map((_, index) => (
                    <Cell key={index} fill={ERROR_PIE_COLORS[index % ERROR_PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val, name) => [`${val} errors`, name]} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
