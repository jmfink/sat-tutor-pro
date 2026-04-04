'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  Star,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { InsightCard } from '@/components/insight-card';
import { INSIGHT_DIMENSIONS } from '@/lib/constants';
import { useAuth } from '@/components/auth-provider';
import type { WrongAnswerInsight, InsightDimension } from '@/types';
import { toast } from 'sonner';
import Link from 'next/link';

const THRESHOLD = 10;

function DimensionCard({
  dimensionId,
  label,
  icon,
  detail,
}: {
  dimensionId: string;
  label: string;
  icon: string;
  detail: InsightDimension | null;
}) {
  const severityStyle = detail
    ? {
        high: 'border-red-200 bg-red-50',
        medium: 'border-orange-200 bg-orange-50',
        low: 'border-blue-50 bg-blue-50',
      }[detail.severity] ?? 'border-slate-200 bg-white'
    : 'border-slate-200 bg-white';

  return (
    <Link
      href={`/insights/${dimensionId}`}
      className={`
        group flex flex-col gap-2 p-4 rounded-xl border-2 transition-all duration-150
        hover:shadow-md hover:border-blue-300 no-underline ${severityStyle}
      `}
    >
      <div className="flex items-start justify-between">
        <span className="text-2xl">{icon}</span>
        {detail && (
          <Badge
            variant="outline"
            className={`text-[10px] capitalize ${
              detail.severity === 'high'
                ? 'bg-red-100 text-red-700 border-red-200'
                : detail.severity === 'medium'
                ? 'bg-orange-100 text-orange-700 border-orange-200'
                : 'bg-blue-100 text-blue-700 border-blue-200'
            }`}
          >
            {detail.severity}
          </Badge>
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
          {label}
        </p>
        {detail ? (
          <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
            {detail.finding}
          </p>
        ) : (
          <p className="text-xs text-slate-400 mt-0.5">No data yet</p>
        )}
      </div>
      <div className="flex items-center gap-1 text-xs text-blue-600 font-medium group-hover:gap-2 transition-all">
        Deep dive <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}

export default function InsightsPage() {
  const router = useRouter();
  const { userId } = useAuth();
  const [insight, setInsight] = useState<WrongAnswerInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);

  const fetchInsights = useCallback(async (forceRefresh = false): Promise<boolean> => {
    const method = forceRefresh ? 'POST' : 'GET';
    const url = forceRefresh
      ? '/api/claude/analyze-patterns'
      : `/api/claude/analyze-patterns?studentId=${userId ?? ''}`;

    const body = forceRefresh
      ? JSON.stringify({ studentId: userId ?? '' })
      : undefined;

    const headers: Record<string, string> = forceRefresh
      ? { 'Content-Type': 'application/json' }
      : {};

    const res = await fetch(url, { method, headers, body });

    if (!res.ok) {
      if (res.status === 404 || res.status === 204) {
        setInsight(null);
        return false;
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error((errData as { error?: string }).error || `Server error ${res.status}`);
    }

    const data = await res.json();
    if (data?.wrong_answers_count !== undefined) {
      setWrongCount(data.wrong_answers_count);
    }
    if (data?.insight?.id) {
      setInsight(data.insight);
      return true;
    }
    return false;
  }, [userId]);

  useEffect(() => {
    fetchInsights(false).catch(() => {}).finally(() => setLoading(false));
  }, [fetchInsights]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const gotInsight = await fetchInsights(true);
      if (gotInsight) {
        toast.success('Insights refreshed!');
      } else {
        toast.error('Analysis returned no data — try again in a moment.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not refresh insights.');
    } finally {
      setRefreshing(false);
    }
  };

  // Look up the sub-skill of the first evidence question, then navigate to
  // the study page with that sub-skill pre-selected so it auto-launches a
  // Quick Drill instead of the generic study chooser.
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
        // non-critical — fall back to generic study page
      }
    }
    if (subSkillId) {
      router.push(`/study?subSkill=${encodeURIComponent(subSkillId)}`);
    } else {
      router.push('/study');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto" />
          <p className="text-slate-500 text-sm">Loading insights...</p>
        </div>
      </div>
    );
  }

  // wrongCount is set from the API's count query — use it as the authoritative source.
  // Fall back to insight.total_wrong_answers_analyzed only if wrongCount hasn't loaded yet.
  const effectiveWrongCount = wrongCount > 0 ? wrongCount : (insight?.total_wrong_answers_analyzed ?? 0);
  const hasThreshold = effectiveWrongCount >= THRESHOLD;
  const pct = Math.min(100, Math.round((effectiveWrongCount / THRESHOLD) * 100));

  return (
    <div className="p-6 max-w-5xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Star className="h-5 w-5 text-amber-500" fill="currentColor" />
            <h1 className="text-2xl font-black text-slate-900">Wrong Answer Insights</h1>
          </div>
          <p className="text-slate-500 text-sm">
            AI-powered pattern analysis across your mistake history.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing || !hasThreshold}
          className="border-slate-200 text-slate-600 hover:border-blue-300"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1.5" />
          )}
          Refresh Insights
        </Button>
      </div>

      {/* Pre-threshold state */}
      {!hasThreshold && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Building Your Insight Profile
              </h2>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                {effectiveWrongCount === 0
                  ? "Every question you get wrong is a step toward understanding your weak spots. Start practicing and we'll track your patterns automatically!"
                  : effectiveWrongCount < 5
                  ? `Nice start! ${THRESHOLD - effectiveWrongCount} more wrong answers and we'll begin identifying your patterns.`
                  : `Almost there — just ${THRESHOLD - effectiveWrongCount} more wrong answers needed to unlock your personalized insights!`}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-slate-700">
                {effectiveWrongCount} / {THRESHOLD} wrong answers analyzed
              </span>
              <span className="text-slate-500">{pct}%</span>
            </div>
            <Progress value={pct} className="h-3 rounded-full" />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800 mb-1">How to unlock insights faster:</p>
            <ul className="space-y-1 text-xs text-blue-700">
              <li>• Answer more questions during study sessions</li>
              <li>• Take a full practice test</li>
              <li>• Review your spaced repetition queue regularly</li>
            </ul>
          </div>

          <Button
            onClick={() => router.push('/study')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            Start Practicing
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Locked dimension preview — shown only in pre-threshold state */}
      {!hasThreshold && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">
            What the AI is analyzing
          </p>
          <div className="grid grid-cols-2 gap-3">
            {INSIGHT_DIMENSIONS.map((dim) => (
              <div
                key={dim.id}
                className="flex items-start gap-3 p-4 bg-white rounded-xl border border-slate-200 opacity-60 select-none"
              >
                <span className="text-2xl">{dim.icon}</span>
                <div>
                  <p className="text-sm font-bold text-slate-700">{dim.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Locked</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 text-center pt-1">
            The AI analyzes your mistakes across these 8 dimensions. Keep practicing to unlock your insights.
          </p>
        </div>
      )}

      {/* Ready to generate — threshold met but no insight yet */}
      {hasThreshold && !insight && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Ready to Analyze Your Patterns</h2>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                You have {effectiveWrongCount} wrong answers on record. Click{' '}
                <span className="font-semibold text-slate-700">Refresh Insights</span> above to
                generate your personalized analysis.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Post-threshold insights */}
      {hasThreshold && insight && (
        <>
          {/* Meta info */}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              Last updated:{' '}
              {new Date(insight.generated_at).toLocaleDateString('default', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
              Based on {insight.total_wrong_answers_analyzed} wrong answers
            </span>
          </div>

          {/* Top 3 priority insights */}
          {(insight.top_insights?.length ?? 0) > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                Top Priority Issues
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {insight.top_insights.slice(0, 3).map((ins, idx) => {
                  // Match the top insight back to its dimension key by finding text.
                  // Fall back to the idx-th key in dimension_details so we never
                  // show raw "dim-0 / dim-1 / dim-2" labels.
                  const dimensionKey =
                    Object.entries(insight.dimension_details).find(
                      ([, v]) => v.finding === ins.finding
                    )?.[0] ??
                    Object.keys(insight.dimension_details)[idx] ??
                    `dim-${idx}`;

                  // Resolve the human-readable label from the INSIGHT_DIMENSIONS list
                  const dimensionLabel =
                    INSIGHT_DIMENSIONS.find((d) => d.id === dimensionKey)?.label ??
                    dimensionKey.replace(/_/g, ' ');

                  return (
                    <InsightCard
                      key={idx}
                      insight={ins}
                      rank={(idx + 1) as 1 | 2 | 3}
                      dimension={dimensionLabel}
                      onDrill={() => handleDrill(ins.evidence_question_ids)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* All dimension deep-dive cards */}
          <div>
            <h2 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
              Explore All Dimensions
            </h2>
            {Object.keys(insight.dimension_details).length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                Dimension data is empty — try clicking <span className="font-semibold">Refresh Insights</span> again to regenerate the analysis.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {INSIGHT_DIMENSIONS.map((dim) => (
                  <DimensionCard
                    key={dim.id}
                    dimensionId={dim.id}
                    label={dim.label}
                    icon={dim.icon}
                    detail={insight.dimension_details[dim.id] ?? null}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
