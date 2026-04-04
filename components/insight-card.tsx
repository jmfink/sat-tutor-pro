'use client';

import type { InsightDimension } from '@/types';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, Target, ChevronRight } from 'lucide-react';

interface InsightCardProps {
  insight: InsightDimension;
  rank: 1 | 2 | 3;
  dimension: string;
  onDrill: () => void;
}

const SEVERITY_STYLES = {
  high: {
    badge: 'bg-red-100 text-red-700 border-red-200',
    border: 'border-red-200',
    glow: 'shadow-red-100',
    ring: 'ring-red-200',
  },
  medium: {
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
    border: 'border-orange-200',
    glow: 'shadow-orange-100',
    ring: 'ring-orange-200',
  },
  low: {
    badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    border: 'border-yellow-200',
    glow: 'shadow-yellow-100',
    ring: 'ring-yellow-200',
  },
} as const;

const RANK_STYLES: Record<number, string> = {
  1: 'bg-yellow-500 text-white',
  2: 'bg-slate-400 text-white',
  3: 'bg-orange-300 text-white',
};

function TrendIcon({ trend }: { trend: InsightDimension['trend'] }) {
  if (trend === 'improving') {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
        <TrendingUp className="h-3.5 w-3.5" />
        Improving
      </span>
    );
  }
  if (trend === 'worsening') {
    return (
      <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
        <TrendingDown className="h-3.5 w-3.5" />
        Worsening
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-slate-500 text-xs font-medium">
      <Minus className="h-3.5 w-3.5" />
      Stagnant
    </span>
  );
}

export function InsightCard({ insight, rank, dimension, onDrill }: InsightCardProps) {
  const styles = SEVERITY_STYLES[insight.severity];

  return (
    <div
      className={`
        relative flex flex-col gap-4 p-5 rounded-xl border-2 bg-white
        shadow-md hover:shadow-lg transition-shadow duration-200
        ${styles.border} ${styles.glow}
      `}
    >
      {/* Rank badge */}
      <div className="absolute -top-2.5 -left-2.5">
        <span
          className={`
            inline-flex items-center justify-center w-8 h-8 rounded-full
            text-xs font-black shadow-sm ${RANK_STYLES[rank]}
          `}
        >
          {rank}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {dimension}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full border text-xs font-semibold capitalize ${styles.badge}`}
            >
              {insight.severity} priority
            </span>
            <TrendIcon trend={insight.trend} />
          </div>
          <p className="text-sm font-semibold text-slate-800 leading-snug">
            {insight.finding}
          </p>
        </div>
      </div>

      {/* Evidence count */}
      {insight.evidence_question_ids.length > 0 && (
        <div className="text-xs text-slate-500">
          Based on{' '}
          <span className="font-semibold text-slate-700">
            {insight.evidence_question_ids.length}
          </span>{' '}
          question{insight.evidence_question_ids.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Recommendation */}
      <div className="flex items-start gap-2.5 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
        <Target className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-700 leading-relaxed">{insight.recommendation}</p>
      </div>

      {/* CTA */}
      <Button
        onClick={onDrill}
        variant="outline"
        size="sm"
        className="w-full border-2 border-yellow-200 text-yellow-700 hover:bg-yellow-50 hover:border-yellow-400 font-semibold text-sm transition-colors"
      >
        Start a targeted drill
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
