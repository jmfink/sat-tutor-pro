'use client';

import type { ScorePrediction } from '@/types';
import {
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface ProgressChartProps {
  predictions: ScorePrediction[];
}

interface ChartDataPoint {
  date: string;
  dateLabel: string;
  total_mid: number;
  total_low: number;
  total_high: number;
  rw: number;
  math: number;
  band_low: number;
  band_high: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload as ChartDataPoint;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-slate-700 mb-2">{data?.dateLabel}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Total (mid)</span>
          <span className="font-bold text-slate-800">{data?.total_mid}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-400 text-[11px]">Range</span>
          <span className="text-slate-500 text-[11px]">
            {data?.total_low} – {data?.total_high}
          </span>
        </div>
        <div className="border-t border-slate-100 pt-1.5 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              R&W
            </span>
            <span className="font-semibold text-blue-700">{data?.rw}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
              Math
            </span>
            <span className="font-semibold text-purple-700">{data?.math}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export function ProgressChart({ predictions }: ProgressChartProps) {
  if (!predictions || predictions.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-slate-400 text-sm">No prediction data yet. Keep practicing!</p>
      </div>
    );
  }

  const data: ChartDataPoint[] = predictions
    .slice()
    .sort((a, b) => a.predicted_at.localeCompare(b.predicted_at))
    .map((p) => {
      let dateLabel = p.predicted_at;
      try {
        dateLabel = format(parseISO(p.predicted_at), 'MMM d');
      } catch {
        dateLabel = p.predicted_at.slice(0, 10);
      }
      return {
        date: p.predicted_at,
        dateLabel,
        total_mid: p.total_score_mid,
        total_low: p.total_score_low,
        total_high: p.total_score_high,
        rw: p.rw_score,
        math: p.math_score,
        // For area band: [low, high] — we use two keys
        band_low: p.total_score_low,
        band_high: p.total_score_high,
      };
    });

  const latestTotal = data[data.length - 1]?.total_mid ?? 0;
  const firstTotal = data[0]?.total_mid ?? 0;
  const delta = latestTotal - firstTotal;
  const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;

  // Score domain bounds
  const allValues = data.flatMap((d) => [d.total_low, d.total_high, d.rw, d.math]);
  const minVal = Math.max(400, Math.floor((Math.min(...allValues) - 50) / 100) * 100);
  const maxVal = Math.min(1600, Math.ceil((Math.max(...allValues) + 50) / 100) * 100);

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="flex items-start gap-6">
        <div>
          <p className="text-xs text-slate-500">Current Predicted Score</p>
          <p className="text-3xl font-black text-slate-800">{latestTotal}</p>
          {data.length > 1 && (
            <p className={`text-sm font-semibold ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {deltaStr} pts since start
            </p>
          )}
        </div>
        <div className="flex gap-4 pt-1">
          <div className="text-center">
            <p className="text-xs text-slate-400">R&W</p>
            <p className="text-lg font-bold text-blue-600">{data[data.length - 1]?.rw ?? '--'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400">Math</p>
            <p className="text-lg font-bold text-purple-600">{data[data.length - 1]?.math ?? '--'}</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.03} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            dy={6}
          />
          <YAxis
            domain={[minVal, maxVal]}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v.toString()}
            width={44}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Confidence band */}
          <Area
            type="monotone"
            dataKey="band_high"
            stroke="none"
            fill="url(#bandGradient)"
            fillOpacity={1}
            legendType="none"
            name="High range"
          />
          <Area
            type="monotone"
            dataKey="band_low"
            stroke="none"
            fill="white"
            fillOpacity={1}
            legendType="none"
            name="Low range"
          />

          {/* Section lines */}
          <Line
            type="monotone"
            dataKey="rw"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            name="Reading & Writing"
          />
          <Line
            type="monotone"
            dataKey="math"
            stroke="#a855f7"
            strokeWidth={2}
            dot={{ fill: '#a855f7', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            name="Math"
          />

          {/* Total midpoint line */}
          <Line
            type="monotone"
            dataKey="total_mid"
            stroke="#1e293b"
            strokeWidth={2.5}
            strokeDasharray="5 3"
            dot={{ fill: '#1e293b', r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            name="Total (predicted)"
          />

          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 8 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
