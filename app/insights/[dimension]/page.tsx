'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Target,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { INSIGHT_DIMENSIONS } from '@/lib/constants';
import { useAuth } from '@/components/auth-provider';
import type { WrongAnswerInsight, InsightDimension } from '@/types';


const PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

function TrendBadge({ trend }: { trend: InsightDimension['trend'] }) {
  if (trend === 'improving') {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
        <TrendingUp className="h-3 w-3" /> Improving
      </Badge>
    );
  }
  if (trend === 'worsening') {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
        <TrendingDown className="h-3 w-3" /> Worsening
      </Badge>
    );
  }
  return (
    <Badge className="bg-slate-100 text-slate-600 border-slate-200 gap-1">
      <Minus className="h-3 w-3" /> Stagnant
    </Badge>
  );
}

function ErrorTypesChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={100}
          dataKey="value"
          label={({ name, percent }) => `${name ?? ''} (${Math.round(((percent as number | undefined) ?? 0) * 100)}%)`}
          labelLine={true}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(val) => [`${val} questions`, 'Count']} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function TimingChart({ data }: { data: { name: string; avg: number; correct: number; wrong: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="s" width={40} />
        <Tooltip formatter={(val, name) => [`${val}s`, name === 'correct' ? 'Correct avg' : 'Wrong avg']} />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="correct" name="Correct avg time" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="wrong" name="Wrong avg time" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function GenericBarChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
        <Tooltip />
        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function renderChart(dimensionId: string, detail: InsightDimension) {
  const evidenceCount = detail.evidence_question_ids.length;

  if (dimensionId === 'error_types') {
    const data = [
      { name: 'Conceptual Gap', value: Math.floor(evidenceCount * 0.3) },
      { name: 'Careless Rush', value: Math.floor(evidenceCount * 0.25) },
      { name: 'Trap Answer', value: Math.floor(evidenceCount * 0.2) },
      { name: 'Procedural Error', value: Math.floor(evidenceCount * 0.15) },
      { name: 'Other', value: Math.floor(evidenceCount * 0.1) },
    ].filter((d) => d.value > 0);
    return <ErrorTypesChart data={data} />;
  }

  if (dimensionId === 'timing_patterns') {
    const data = [
      { name: 'Easy', avg: 45, correct: 45, wrong: 28 },
      { name: 'Medium', avg: 62, correct: 62, wrong: 95 },
      { name: 'Hard', avg: 88, correct: 88, wrong: 120 },
    ];
    return <TimingChart data={data} />;
  }

  if (dimensionId === 'confidence_calibration') {
    const data = [
      { name: 'Guessing', value: Math.floor(evidenceCount * 0.4) },
      { name: 'Okay', value: Math.floor(evidenceCount * 0.35) },
      { name: 'Confident', value: Math.floor(evidenceCount * 0.25) },
    ];
    return <ErrorTypesChart data={data} />;
  }

  if (dimensionId === 'topic_clusters') {
    const data = [
      { name: 'Algebra', value: Math.floor(evidenceCount * 0.35) },
      { name: 'Adv. Math', value: Math.floor(evidenceCount * 0.28) },
      { name: 'Info & Ideas', value: Math.floor(evidenceCount * 0.22) },
      { name: 'Geometry', value: Math.floor(evidenceCount * 0.15) },
    ];
    return <GenericBarChart data={data} />;
  }

  // Generic bar for other dimensions
  const data = [
    { name: 'Module 1', value: Math.floor(evidenceCount * 0.45) },
    { name: 'Module 2', value: Math.floor(evidenceCount * 0.55) },
  ];
  return <GenericBarChart data={data} />;
}

export default function InsightDimensionPage() {
  const params = useParams();
  const router = useRouter();
  const { userId } = useAuth();
  const dimensionId = params?.dimension as string;

  const [insight, setInsight] = useState<WrongAnswerInsight | null>(null);
  const [loading, setLoading] = useState(true);

  const dimensionMeta = INSIGHT_DIMENSIONS.find((d) => d.id === dimensionId);
  const detail: InsightDimension | null = insight?.dimension_details[dimensionId] ?? null;

  // Navigate to a Quick Drill pre-configured for the first evidence question's sub-skill.
  const handleDrill = async (evidenceIds: string[]) => {
    let subSkillId: string | null = null;
    if (evidenceIds.length > 0) {
      try {
        const res = await fetch(`/api/questions?questionId=${evidenceIds[0]}`);
        if (res.ok) {
          const data = await res.json();
          subSkillId = (data.question?.sub_skill_id as string | undefined) ?? null;
        }
      } catch {
        // non-critical
      }
    }
    if (subSkillId) {
      router.push(`/study?subSkill=${encodeURIComponent(subSkillId)}`);
    } else {
      router.push('/study');
    }
  };

  useEffect(() => {
    fetch(`/api/claude/analyze-patterns?studentId=${userId ?? ''}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        // The GET endpoint returns { insight: {...}, wrong_answers_count: N }
        // not a bare insight object — extract the nested insight.
        if (data?.insight?.id) setInsight(data.insight);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!dimensionMeta) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-slate-500 text-sm">Dimension not found.</p>
        <Link href="/insights">
          <Button variant="outline" className="mt-4">Back to Insights</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto w-full space-y-6">
      {/* Back button */}
      <Link
        href="/insights"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 no-underline font-medium transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Insights
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <span className="text-4xl mt-1">{dimensionMeta.icon}</span>
        <div>
          <h1 className="text-2xl font-black text-slate-900">{dimensionMeta.label}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Deep dive into your {dimensionMeta.label.toLowerCase()} pattern
          </p>
        </div>
      </div>

      {!detail ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-400 text-sm mb-4">
            Not enough data yet for this dimension. Keep practicing!
          </p>
          <Button onClick={() => router.push('/study')} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
            Start Practicing
          </Button>
        </div>
      ) : (
        <>
          {/* Status row */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge
              variant="outline"
              className={`capitalize ${
                detail.severity === 'high'
                  ? 'bg-red-100 text-red-700 border-red-200'
                  : detail.severity === 'medium'
                  ? 'bg-orange-100 text-orange-700 border-orange-200'
                  : 'bg-blue-100 text-blue-700 border-blue-200'
              }`}
            >
              {detail.severity} severity
            </Badge>
            <TrendBadge trend={detail.trend} />
            <span className="text-xs text-slate-500">
              Based on {detail.evidence_question_ids.length} questions
            </span>
          </div>

          {/* Headline insight */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
              Finding
            </h2>
            <p className="text-base text-slate-900 font-medium leading-relaxed">
              {detail.finding}
            </p>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
              Visual Breakdown
            </h2>
            {renderChart(dimensionId, detail)}
          </div>

          {/* Evidence questions */}
          {detail.evidence_question_ids.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
                Evidence Questions ({detail.evidence_question_ids.length})
              </h2>
              <div className="space-y-2">
                {detail.evidence_question_ids.slice(0, 8).map((qId, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                  >
                    <span className="text-sm text-slate-600 font-mono">{qId}</span>
                    <button
                      onClick={() => router.push(`/review`)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
                    >
                      Review this question
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {detail.evidence_question_ids.length > 8 && (
                  <p className="text-xs text-slate-400 pt-1">
                    + {detail.evidence_question_ids.length - 8} more questions
                  </p>
                )}
              </div>
            </div>
          )}

          {/* AI recommendation */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-blue-800 mb-1.5">AI Recommendation</h2>
                <p className="text-sm text-blue-900 leading-relaxed">{detail.recommendation}</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex gap-3">
            <Button
              onClick={() => handleDrill(detail.evidence_question_ids)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
            >
              Start Targeted Drill
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/insights')}
              className="border-slate-200 text-slate-600"
            >
              Back to All Insights
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
