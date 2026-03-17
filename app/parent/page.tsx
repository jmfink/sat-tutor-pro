'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Lock,
  Eye,
  EyeOff,
  Users,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Upload,
  Loader2,
  TrendingDown,
  Flag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { QuestionUploader } from '@/components/question-uploader';
import type { Session, WrongAnswerInsight, ScorePrediction } from '@/types';

import { DEMO_STUDENT_ID } from '@/lib/constants';

interface QuestionFeedback {
  id: string;
  question_id: string;
  feedback_type: 'bad_question' | 'bad_explanation';
  created_at: string;
  questions?: {
    question_id: string;
    question_text: string;
    section: string;
    sub_skill_id: string;
    difficulty: number;
  } | null;
}

const DEMO_PIN = process.env.NEXT_PUBLIC_PARENT_PIN ?? '1234';
const STUDENT_NAME = 'Ethan';

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`rounded-xl border-2 p-4 ${color}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-2xl font-black text-slate-900">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

function AlertBadge({ type, label }: { type: 'warning' | 'danger' | 'ok'; label: string }) {
  const styles = {
    warning: 'bg-amber-100 text-amber-800 border-amber-300',
    danger: 'bg-red-100 text-red-800 border-red-300',
    ok: 'bg-green-100 text-green-800 border-green-300',
  };
  const icons = {
    warning: <AlertTriangle className="h-3 w-3" />,
    danger: <AlertTriangle className="h-3 w-3" />,
    ok: <CheckCircle2 className="h-3 w-3" />,
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${styles[type]}`}>
      {icons[type]}
      {label}
    </span>
  );
}

function SessionRow({ session }: { session: Session }) {
  const date = new Date(session.started_at);
  const hasAnswers = session.questions_answered > 0;
  const accuracy = hasAnswers
    ? Math.round((session.questions_correct / session.questions_answered) * 100)
    : null;
  const durationMs = session.ended_at
    ? new Date(session.ended_at).getTime() - date.getTime()
    : 0;
  const durationMin = Math.round(durationMs / 60000);

  const typeLabel: Record<string, string> = {
    quick_drill: 'Quick Drill',
    study_session: 'Study Session',
    timed_section: 'Timed',
    full_practice_test: 'Full Test',
    review: 'Review',
  };

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
      <td className="py-2.5 px-3 text-xs text-slate-600">
        {date.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
      </td>
      <td className="py-2.5 px-3">
        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
          {typeLabel[session.session_type] ?? session.session_type}
        </Badge>
      </td>
      <td className="py-2.5 px-3 text-xs text-slate-600">
        {durationMin > 0 ? `${durationMin} min` : '—'}
      </td>
      <td className="py-2.5 px-3 text-xs font-bold">
        {accuracy === null ? (
          <span className="text-slate-400">—</span>
        ) : (
          <span className={accuracy >= 80 ? 'text-green-600' : accuracy >= 60 ? 'text-yellow-600' : 'text-red-600'}>
            {accuracy}%
          </span>
        )}
      </td>
      <td className="py-2.5 px-3 text-xs text-slate-500">
        {hasAnswers ? `${session.questions_correct}/${session.questions_answered} correct` : '—'}
      </td>
    </tr>
  );
}

export default function ParentPage() {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinError, setPinError] = useState('');
  const [loading, setLoading] = useState(false);

  // Dashboard data
  const [prediction, setPrediction] = useState<ScorePrediction | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [insight, setInsight] = useState<WrongAnswerInsight | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [timeStudiedHours, setTimeStudiedHours] = useState(0);
  const [showUploader, setShowUploader] = useState(false);
  const [feedback, setFeedback] = useState<QuestionFeedback[]>([]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPinError('');

    setTimeout(() => {
      if (pin === DEMO_PIN) {
        setIsAuthenticated(true);
        setDataLoading(true);
        setLoading(false);
      } else {
        setPinError('Incorrect PIN. Try again.');
        setPin('');
        setLoading(false);
      }
    }, 500);
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    Promise.all([
      fetch(`/api/claude/predict-score?studentId=${DEMO_STUDENT_ID}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/sessions?studentId=${DEMO_STUDENT_ID}&limit=20`)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => Array.isArray(d) ? d : d?.sessions ?? [])
        .catch(() => []),
      fetch(`/api/claude/analyze-patterns?studentId=${DEMO_STUDENT_ID}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch('/api/feedback?limit=30')
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ]).then(([pred, sess, ins, feedbackData]) => {
      if (pred) setPrediction(Array.isArray(pred) ? (pred[0] ?? null) : pred);
      setSessions(sess);
      if (ins?.insight?.id) setInsight(ins.insight);
      setFeedback(Array.isArray(feedbackData) ? feedbackData : []);

      // Compute time studied (this week)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const thisWeekSessions = sess.filter(
        (s: Session) => s.ended_at && new Date(s.started_at) >= weekAgo
      );
      const totalMs = thisWeekSessions.reduce((acc: number, s: Session) => {
        if (!s.ended_at) return acc;
        return acc + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime());
      }, 0);
      setTimeStudiedHours(Math.round(totalMs / 3600000 * 10) / 10);
    }).finally(() => setDataLoading(false));
  }, [isAuthenticated]);

  // Compute alerts
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const sessionCountThisWeek = sessions.filter(
    (s) => new Date(s.started_at) >= weekAgo
  ).length;

  const lastSession = sessions[0] ? new Date(sessions[0].started_at) : null;
  const noStudyRecently = lastSession ? lastSession < threeDaysAgo : true;

  const alerts: { type: 'warning' | 'danger' | 'ok'; label: string }[] = [];
  if (noStudyRecently && sessions.length > 0) {
    alerts.push({ type: 'warning', label: 'No study in 3+ days' });
  }
  if (sessionCountThisWeek >= 5) {
    alerts.push({ type: 'ok', label: '5+ sessions this week' });
  }
  if (insight?.top_insights[0]?.trend === 'worsening') {
    alerts.push({ type: 'danger', label: 'Skill regression detected' });
  }

  // PIN entry screen
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-lg p-8 space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3">
              <Users className="h-7 w-7 text-purple-600" />
            </div>
            <h1 className="text-xl font-black text-slate-900">Parent Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">
              Enter your PIN to access {STUDENT_NAME}&apos;s progress.
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">PIN</label>
              <div className="relative">
                <Input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter 4-digit PIN"
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="pr-10 text-center text-2xl font-bold tracking-widest border-slate-200"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pinError && <p className="text-xs text-red-600">{pinError}</p>}
            </div>

            <Button
              type="submit"
              disabled={pin.length !== 4 || loading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Verifying...' : 'Access Dashboard'}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-xs text-slate-400">
              Demo PIN: <span className="font-mono font-bold text-slate-600">1234</span>
            </p>
          </div>

          <div className="border-t border-slate-100 pt-4 text-center">
            <Link
              href="/"
              className="text-xs text-blue-500 hover:text-blue-700 no-underline font-medium"
            >
              Back to Student Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Parent dashboard
  if (dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-5 w-5 text-purple-600" />
            <h1 className="text-2xl font-black text-slate-900">Parent Dashboard</h1>
          </div>
          <p className="text-slate-500 text-sm">Tracking {STUDENT_NAME}&apos;s SAT prep progress.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAuthenticated(false)}
          className="border-slate-200 text-slate-600 text-xs"
        >
          <Lock className="h-3.5 w-3.5 mr-1.5" />
          Lock
        </Button>
      </div>

      {/* Alert badges */}
      {alerts.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {alerts.map((alert, i) => (
            <AlertBadge key={i} type={alert.type} label={alert.label} />
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Predicted Score"
          value={prediction?.total_score_mid ?? '—'}
          sub={prediction ? 'out of 1600' : 'Need more practice data'}
          icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
          color="border-blue-200 bg-blue-50/50"
        />
        <StatCard
          label="Time Studied"
          value={`${timeStudiedHours}h`}
          sub="this week"
          icon={<Clock className="h-5 w-5 text-purple-600" />}
          color="border-purple-200 bg-purple-50/50"
        />
        <StatCard
          label="Sessions"
          value={sessionCountThisWeek}
          sub="this week"
          icon={<BookOpen className="h-5 w-5 text-green-600" />}
          color="border-green-200 bg-green-50/50"
        />
        <StatCard
          label="Last Study"
          value={
            lastSession
              ? lastSession.toLocaleDateString('default', { month: 'short', day: 'numeric' })
              : 'Never'
          }
          sub={lastSession ? lastSession.toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' }) : '—'}
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          color={`${noStudyRecently && sessions.length > 0 ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'}`}
        />
      </div>

      {/* Score breakdown */}
      {prediction && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
            Score Breakdown
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Total Predicted</p>
              <p className="text-3xl font-black text-slate-900">{prediction.total_score_mid}</p>
              <p className="text-xs text-slate-400">Range: {prediction.total_score_low}–{prediction.total_score_high}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Reading & Writing</p>
              <p className="text-3xl font-black text-blue-700">{prediction.rw_score}</p>
              <Progress value={(prediction.rw_score / 800) * 100} className="h-1.5 mt-2" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Math</p>
              <p className="text-3xl font-black text-purple-700">{prediction.math_score}</p>
              <Progress value={(prediction.math_score / 800) * 100} className="h-1.5 mt-2" />
            </div>
          </div>
        </div>
      )}

      {/* Top 3 weaknesses */}
      {insight && insight.top_insights.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
            Top Areas to Improve
          </h2>
          <div className="space-y-3">
            {insight.top_insights.slice(0, 3).map((ins, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                  i === 0 ? 'bg-red-500 text-white' : i === 1 ? 'bg-orange-400 text-white' : 'bg-yellow-400 text-white'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize ${
                        ins.severity === 'high'
                          ? 'bg-red-100 text-red-700 border-red-200'
                          : ins.severity === 'medium'
                          ? 'bg-orange-100 text-orange-700 border-orange-200'
                          : 'bg-blue-100 text-blue-700 border-blue-200'
                      }`}
                    >
                      {ins.severity}
                    </Badge>
                    {ins.trend === 'worsening' && (
                      <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-800 leading-relaxed">{ins.finding}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session history table */}
      {sessions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
              Session History
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                  <th className="text-left py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="text-left py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Duration</th>
                  <th className="text-left py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Accuracy</th>
                  <th className="text-left py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Results</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 15).map((s, i) => (
                  <SessionRow key={s.id ?? i} session={s} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Flagged Questions & Explanations */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <Flag className="h-4 w-4 text-red-500" />
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
            Flagged Questions & Explanations
          </h2>
          {feedback.length > 0 && (
            <span className="ml-auto text-xs font-semibold text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
              {feedback.length} flagged
            </span>
          )}
        </div>
        {feedback.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-slate-400 text-sm">No questions or explanations flagged yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {feedback.map((item) => (
              <div key={item.id} className="px-5 py-3 flex items-start gap-3">
                <span className={`shrink-0 mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  item.feedback_type === 'bad_question'
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : 'bg-amber-100 text-amber-700 border-amber-200'
                }`}>
                  {item.feedback_type === 'bad_question' ? 'Bad question' : 'Bad explanation'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 line-clamp-2">
                    {item.questions?.question_text ?? item.question_id}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {item.questions?.section === 'reading_writing' ? 'Reading & Writing' : 'Math'} ·{' '}
                    {item.questions?.sub_skill_id} ·{' '}
                    {new Date(item.created_at).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PDF upload section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
              Upload Practice Questions
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload SAT practice test PDFs to add questions to {STUDENT_NAME}&apos;s question bank.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUploader((v) => !v)}
            className="border-slate-200 text-slate-600"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {showUploader ? 'Hide Uploader' : 'Upload PDFs'}
          </Button>
        </div>
        {showUploader && (
          <QuestionUploader
            studentName={STUDENT_NAME}
            onDismiss={() => setShowUploader(false)}
            onComplete={() => {
              // Refresh question count after successful upload
              fetch('/api/questions?studentId=' + DEMO_STUDENT_ID)
                .catch(() => {});
            }}
          />
        )}
      </div>

      {/* Login hint */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500">
        <p>
          <span className="font-semibold text-slate-700">Note:</span> In production, parent access uses
          a secure Supabase Auth session with email verification. The PIN system shown here is for demo
          purposes only.
        </p>
      </div>
    </div>
  );
}
