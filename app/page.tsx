'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  ClipboardList,
  Clock,
  TrendingUp,
  Zap,
  ChevronRight,
  Target,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { StreakCounter } from '@/components/streak-counter';
import type { Session, ScorePrediction, DailyActivity, WrongAnswerInsight } from '@/types';
import { SESSION_TYPE_LABELS, SESSION_TYPE_COLORS, calcAccuracy } from '@/lib/constants';
import { useAuth } from '@/components/auth-provider';
import { toLocalDateKey } from '@/lib/utils';

const STUDENT_NAME = process.env.NEXT_PUBLIC_STUDENT_NAME ?? 'Student';

function ScorePredictionWidget({ prediction, loading }: { prediction: ScorePrediction | null; loading: boolean }) {
  if (!prediction) {
    return (
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-5 text-white shadow-lg">
        <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide mb-1">Predicted Score</p>
        {loading ? (
          <div className="h-10 bg-blue-500/40 rounded-lg animate-pulse mb-2" />
        ) : (
          <p className="text-4xl font-black text-white/40 mb-2">—</p>
        )}
        <p className="text-blue-200 text-xs leading-relaxed">
          {loading
            ? 'Loading your score prediction...'
            : 'Answer 20+ questions to unlock your personalized score prediction'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-5 text-white shadow-lg">
      <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide mb-1">Predicted Score</p>
      <div className="flex items-end gap-2 mb-1">
        <span className="text-4xl font-black">{prediction.total_score_mid}</span>
        <span className="text-blue-300 mb-1 text-sm">/ 1600</span>
      </div>
      <p className="text-blue-200 text-xs mb-3">
        Range: {prediction.total_score_low} – {prediction.total_score_high}
      </p>
      <div className="flex gap-4">
        <div>
          <p className="text-[10px] text-blue-300 uppercase tracking-wide">R&W</p>
          <p className="text-lg font-bold">{prediction.rw_score}</p>
        </div>
        <div>
          <p className="text-[10px] text-blue-300 uppercase tracking-wide">Math</p>
          <p className="text-lg font-bold">{prediction.math_score}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[10px] text-blue-300 uppercase tracking-wide">Confidence</p>
          <p className="text-lg font-bold">{Math.round((prediction.confidence ?? 0) * 100)}%</p>
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({
  icon,
  title,
  description,
  badge,
  href,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-150 no-underline"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
            {title}
          </p>
          {badge && (
            <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0">
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors self-end" />
    </Link>
  );
}

function SessionRow({ session }: { session: Session }) {
  const date = new Date(session.started_at);
  const hasAnswers = session.questions_answered > 0;
  const accuracy = hasAnswers ? calcAccuracy(session.questions_correct, session.questions_answered) : null;

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Badge variant="outline" className={`text-[10px] ${SESSION_TYPE_COLORS[session.session_type] ?? ''}`}>
            {SESSION_TYPE_LABELS[session.session_type] ?? session.session_type}
          </Badge>
          <span className="text-xs text-slate-400">
            {date.toLocaleDateString('default', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        {session.summary ? (
          <p className="text-xs text-slate-600 line-clamp-1">{session.summary}</p>
        ) : (
          <p className="text-xs text-slate-400">
            {hasAnswers ? `${session.questions_answered} questions answered` : 'No questions answered'}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p
          className={`text-sm font-bold ${
            accuracy === null
              ? 'text-slate-400'
              : accuracy >= 80 ? 'text-green-600' : accuracy >= 60 ? 'text-yellow-600' : 'text-red-600'
          }`}
        >
          {accuracy !== null ? `${accuracy}%` : '—'}
        </p>
        {hasAnswers && (
          <p className="text-[10px] text-slate-400">
            {session.questions_correct}/{session.questions_answered}
          </p>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { userId } = useAuth();
  const [prediction, setPrediction] = useState<ScorePrediction | null>(null);
  const [predLoading, setPredLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [insight, setInsight] = useState<WrongAnswerInsight | null>(null);
  const [streak, setStreak] = useState(0);
  const [weekSessions, setWeekSessions] = useState(0);
  const [weekQuestions, setWeekQuestions] = useState(0);

  useEffect(() => {
    // Fetch score prediction (GET returns array; take the most recent)
    fetch(`/api/claude/predict-score?studentId=${userId ?? ''}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setPrediction(Array.isArray(data) ? (data[0] ?? null) : data);
      })
      .catch(() => {})
      .finally(() => setPredLoading(false));

    // Fetch sessions — 50 gives enough history for weekly goal computation and recent list
    fetch(`/api/sessions?studentId=${userId ?? ''}&limit=50`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list: Session[] = Array.isArray(data) ? data : (data?.sessions ?? []);
        setSessions(list);
        // Compute weekly goal progress here (effects can safely call Date.now)
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const ws = list.filter((s) => new Date(s.started_at) >= cutoff);
        setWeekSessions(ws.length);
        setWeekQuestions(ws.reduce((sum, s) => sum + (s.questions_answered ?? 0), 0));
      })
      .catch(() => {})
      .finally(() => setSessionsLoading(false));

    // Fetch review queue count
    fetch(`/api/review?studentId=${userId ?? ''}&countOnly=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.count !== undefined) setReviewCount(data.count);
      })
      .catch(() => {});

    // Fetch insights for teaser
    fetch(`/api/claude/analyze-patterns?studentId=${userId ?? ''}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.insight?.id) setInsight(data.insight);
      })
      .catch(() => {});

    // Fetch streak / activity — pass local date so streak counts in user's timezone
    fetch(`/api/sessions/streak?studentId=${userId ?? ''}&localDate=${toLocalDateKey()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.currentStreak !== undefined) setStreak(data.currentStreak);
        if (Array.isArray(data?.dailyActivity)) setDailyActivity(data.dailyActivity);
      })
      .catch(() => {});
  }, [userId]);

  const weeklyGoals = [
    { id: 1, label: 'Complete 5 study sessions this week', target: 5, current: weekSessions },
    { id: 2, label: 'Answer 50 questions this week', target: 50, current: weekQuestions },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Good {getGreeting()}, {STUDENT_NAME}!
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Ready to crush today&apos;s goals?</p>
        </div>
        <Button
          onClick={() => router.push('/study')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
        >
          <Zap className="h-4 w-4 mr-1.5" />
          Start Studying
        </Button>
      </div>

      {/* Top row: score prediction + streak */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ScorePredictionWidget prediction={prediction} loading={predLoading} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Study Streak
          </p>
          <StreakCounter
            currentStreak={streak}
            dailyActivity={dailyActivity}
            weeklyGoal={5}
          />
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickActionCard
            icon={<BookOpen className="h-5 w-5 text-blue-600" />}
            title="Start Study Session"
            description="Adaptive questions tailored to your weaknesses"
            href="/study"
            color="bg-blue-100"
          />
          <QuickActionCard
            icon={<ClipboardList className="h-5 w-5 text-purple-600" />}
            title="Practice Test"
            description="Full SAT simulation with timed modules"
            href="/practice-test"
            color="bg-purple-100"
          />
          <QuickActionCard
            icon={<Clock className="h-5 w-5 text-amber-600" />}
            title="Review Queue"
            description="Spaced repetition cards due for review"
            badge={reviewCount > 0 ? `${reviewCount} due` : undefined}
            href="/review"
            color="bg-amber-100"
          />
        </div>
      </div>

      {/* Main content: sessions + goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent sessions */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-800">Recent Sessions</h2>
            <Link
              href="/progress"
              className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-0.5 no-underline"
            >
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {sessionsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No sessions yet</p>
              <p className="text-slate-400 text-xs">Start your first study session!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sessions.slice(0, 5).map((s, i) => (
                <SessionRow key={s.id ?? i} session={s} />
              ))}
            </div>
          )}
        </div>

        {/* Weekly goals */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-3">Weekly Goals</h2>
          <div className="space-y-4">
            {weeklyGoals.map((goal) => {
              const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
              const done = goal.current >= goal.target;
              return (
                <div key={goal.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {done ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Target className="h-4 w-4 text-slate-400" />
                      )}
                      <p className={`text-xs font-medium ${done ? 'text-green-700' : 'text-slate-700'}`}>
                        {goal.label}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">{goal.current}/{goal.target}</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </div>

          {/* Insight teaser */}
          {insight && insight.top_insights.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-800 mb-0.5">
                      Top Insight
                    </p>
                    <p className="text-xs text-amber-700 line-clamp-2">
                      {insight.top_insights[0].finding}
                    </p>
                  </div>
                </div>
                <Link
                  href="/insights"
                  className="mt-2 text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-0.5 no-underline"
                >
                  View all insights <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Progress teaser */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-5 text-white shadow-md flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-blue-300" />
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
              Progress Dashboard
            </p>
          </div>
          <p className="text-sm font-bold">See your skill map, score history, and error breakdown</p>
        </div>
        <Link href="/progress">
          <Button variant="outline" className="bg-transparent border-slate-500 text-slate-200 hover:bg-slate-700 hover:text-white shrink-0">
            View Progress
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
