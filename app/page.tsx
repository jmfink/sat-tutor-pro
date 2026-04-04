'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  ClipboardList,
  Lightbulb,
  TrendingUp,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { Session, ScorePrediction } from '@/types';
import { useAuth } from '@/components/auth-provider';
import { toLocalDateKey } from '@/lib/utils';

function ActionCard({
  icon,
  title,
  description,
  badge,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center justify-center text-center gap-2.5 py-6 px-3 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all duration-150 no-underline"
    >
      <div className="flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="flex items-center justify-center gap-1.5 mb-0.5">
          <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors leading-tight">
            {title}
          </p>
          {badge && (
            <span className="bg-red-100 text-red-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { userId, name } = useAuth();
  const [prediction, setPrediction] = useState<ScorePrediction | null>(null);
  const [predLoading, setPredLoading] = useState(true);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [streak, setStreak] = useState(0);
  const [weekSessions, setWeekSessions] = useState(0);
  const [weekQuestions, setWeekQuestions] = useState(0);
  const [weekAccuracy, setWeekAccuracy] = useState<number | null>(null);
  const [daysActiveThisWeek, setDaysActiveThisWeek] = useState(0);

  useEffect(() => {
    if (!userId) return;

    fetch(`/api/claude/predict-score?studentId=${userId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setPrediction(Array.isArray(data) ? (data[0] ?? null) : data);
      })
      .catch(() => {})
      .finally(() => setPredLoading(false));

    fetch(`/api/sessions?studentId=${userId}&limit=50`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list: Session[] = Array.isArray(data) ? data : (data?.sessions ?? []);
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const ws = list.filter((s) => new Date(s.started_at) >= cutoff);
        setWeekSessions(ws.length);
        const wq = ws.reduce((sum, s) => sum + (s.questions_answered ?? 0), 0);
        const wc = ws.reduce((sum, s) => sum + (s.questions_correct ?? 0), 0);
        setWeekQuestions(wq);
        if (wq > 0) setWeekAccuracy(Math.round((wc / wq) * 100));
      })
      .catch(() => {});

    fetch(`/api/review?studentId=${userId}&countOnly=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.count !== undefined) setReviewCount(data.count); })
      .catch(() => {});

    fetch(`/api/sessions/streak?studentId=${userId}&localDate=${toLocalDateKey()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.currentStreak !== undefined) setStreak(data.currentStreak);
        if (Array.isArray(data?.dailyActivity)) {
          // Count days active this week
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          let days = 0;
          const actMap = new Map<string, boolean>();
          for (const a of data.dailyActivity) {
            if (a.streak_qualifying) actMap.set(a.activity_date.slice(0, 10), true);
          }
          for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            if (actMap.has(toLocalDateKey(d))) days++;
          }
          setDaysActiveThisWeek(days);
        }
      })
      .catch(() => {});
  }, [userId]);

  return (
    <div className="p-6 max-w-3xl mx-auto w-full space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Good {getGreeting()}, {name ?? 'there'}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Ready to practice?</p>
        </div>
        {/* Compact score widget */}
        <div className="text-right">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Predicted Score</p>
          {predLoading ? (
            <div className="h-8 w-20 bg-slate-100 rounded animate-pulse mt-0.5" />
          ) : prediction ? (
            <div className="flex items-end gap-1 justify-end">
              <span className="text-2xl font-black text-slate-900">{prediction.total_score_mid}</span>
              <span className="text-sm text-slate-400 mb-0.5">/ 1600</span>
            </div>
          ) : (
            <p className="text-sm text-slate-400 max-w-[160px] text-right leading-tight">
              Complete 20 questions to unlock
            </p>
          )}
        </div>
      </div>

      {/* Primary CTA */}
      <button
        onClick={() => router.push('/study')}
        className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl p-5 text-left flex items-center gap-4 shadow-md transition-colors duration-150"
      >
        <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shrink-0">
          <BookOpen className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-lg font-black">Start Studying</p>
          <p className="text-sm text-blue-200">Adaptive practice session</p>
        </div>
        <ChevronRight className="h-6 w-6 text-blue-300 shrink-0" />
      </button>

      {/* Secondary actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ActionCard
          icon={<Lightbulb className="h-10 w-10 text-amber-400" strokeWidth={1.5} />}
          title="Insights ★"
          description="Wrong answer patterns"
          href="/insights"
        />
        <ActionCard
          icon={<TrendingUp className="h-10 w-10 text-blue-500" strokeWidth={1.5} />}
          title="My Progress"
          description="Skill map and analytics"
          href="/progress"
        />
        <ActionCard
          icon={<ClipboardList className="h-10 w-10 text-slate-400" strokeWidth={1.5} />}
          title="Practice Test"
          description="Full SAT simulation"
          href="/practice-test"
        />
        <ActionCard
          icon={<RefreshCw className="h-10 w-10 text-purple-400" strokeWidth={1.5} />}
          title="Review Queue"
          description="Spaced repetition"
          badge={reviewCount > 0 ? `${reviewCount}` : undefined}
          href="/review"
        />
      </div>

      {/* Combined streak + this week */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start gap-6">
          {/* Streak */}
          <div className="text-center shrink-0">
            <span className="text-4xl font-black text-orange-500">{streak}</span>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {streak === 1 ? 'day streak' : 'day streak'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {streak === 0 ? 'Study today to start' : streak >= 7 ? 'Keep it going' : 'Keep it going'}
            </p>
          </div>

          <div className="flex-1 space-y-3 min-w-0">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">Days active this week</span>
                <span className="font-semibold text-slate-700">{daysActiveThisWeek} / 5</span>
              </div>
              <Progress value={Math.min(100, (daysActiveThisWeek / 5) * 100)} className="h-1.5" />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xl font-black text-slate-900">{weekQuestions}</p>
                <p className="text-xs text-slate-400">questions this week</p>
              </div>
              {weekAccuracy !== null && (
                <div>
                  <p className={`text-xl font-black ${
                    weekAccuracy >= 80 ? 'text-green-600'
                    : weekAccuracy >= 60 ? 'text-yellow-600'
                    : 'text-red-600'
                  }`}>{weekAccuracy}%</p>
                  <p className="text-xs text-slate-400">accuracy</p>
                </div>
              )}
              {weekSessions > 0 && (
                <div className="flex items-center gap-1 text-xs text-green-600 ml-auto">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="font-medium">{weekSessions} session{weekSessions !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Review queue banner — only when cards are due */}
      {reviewCount > 0 && (
        <Link
          href="/review"
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 no-underline hover:bg-amber-100 transition-colors"
        >
          <RefreshCw className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm font-semibold text-amber-800 flex-1">
            {reviewCount} card{reviewCount !== 1 ? 's' : ''} due for review
          </p>
          <ChevronRight className="h-4 w-4 text-amber-500" />
        </Link>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
