'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { SkillMap } from '@/components/skill-map';
import { SUB_SKILLS, getMasteryLevel , DEMO_STUDENT_ID } from '@/lib/constants';
import type { SkillRating, MasteryLevel } from '@/types';


// SVG-based prerequisite tree visualization
const MASTERY_NODE_COLORS: Record<MasteryLevel, { fill: string; stroke: string; text: string }> = {
  developing: { fill: '#fee2e2', stroke: '#fca5a5', text: '#b91c1c' },
  progressing: { fill: '#fef9c3', stroke: '#fde047', text: '#a16207' },
  proficient: { fill: '#dcfce7', stroke: '#86efac', text: '#166534' },
  mastered: { fill: '#fef3c7', stroke: '#fcd34d', text: '#92400e' },
};

interface NodePosition {
  x: number;
  y: number;
  skill: (typeof SUB_SKILLS)[number];
  mastery: MasteryLevel;
  rating: number;
}

function SkillTreeSVG({ skillRatings }: { skillRatings: SkillRating[] }) {
  const ratingMap = new Map<string, SkillRating>(skillRatings.map((r) => [r.sub_skill_id, r]));

  // Only math has prerequisites — build a tree for math skills
  const mathSkills = SUB_SKILLS.filter((s) => s.section === 'math');

  // Layout: row by domain
  const domains: Record<string, typeof mathSkills> = {};
  for (const s of mathSkills) {
    if (!domains[s.domain]) domains[s.domain] = [];
    domains[s.domain].push(s);
  }

  const NODE_W = 110;
  const NODE_H = 44;
  const COL_GAP = 130;
  const ROW_GAP = 70;
  const MARGIN_X = 20;
  const MARGIN_Y = 20;

  const positions: Record<string, NodePosition> = {};
  let rowIndex = 0;

  for (const [, skills] of Object.entries(domains)) {
    skills.forEach((skill, colIndex) => {
      const r = ratingMap.get(skill.id);
      const elo = r?.elo_rating ?? 1000;
      positions[skill.id] = {
        x: MARGIN_X + colIndex * COL_GAP,
        y: MARGIN_Y + rowIndex * ROW_GAP,
        skill,
        mastery: getMasteryLevel(elo),
        rating: elo,
      };
    });
    rowIndex++;
  }

  const maxX = Math.max(...Object.values(positions).map((p) => p.x + NODE_W)) + MARGIN_X;
  const maxY = Math.max(...Object.values(positions).map((p) => p.y + NODE_H)) + MARGIN_Y;

  // Prerequisite edges
  const edges: { from: string; to: string }[] = [];
  for (const skill of mathSkills) {
    for (const prereqId of skill.prerequisites ?? []) {
      if (positions[prereqId] && positions[skill.id]) {
        edges.push({ from: prereqId, to: skill.id });
      }
    }
  }

  return (
    <div className="overflow-x-auto">
      <svg width={maxX} height={maxY} className="font-sans">
        {/* Edges */}
        {edges.map((edge, i) => {
          const from = positions[edge.from];
          const to = positions[edge.to];
          if (!from || !to) return null;
          const x1 = from.x + NODE_W / 2;
          const y1 = from.y + NODE_H;
          const x2 = to.x + NODE_W / 2;
          const y2 = to.y;
          const midY = (y1 + y2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth={1.5}
              markerEnd="url(#arrowhead)"
            />
          );
        })}

        {/* Arrow marker */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="6"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#cbd5e1" />
          </marker>
        </defs>

        {/* Nodes */}
        {Object.values(positions).map((pos) => {
          const colors = MASTERY_NODE_COLORS[pos.mastery];
          return (
            <g key={pos.skill.id}>
              <rect
                x={pos.x}
                y={pos.y}
                width={NODE_W}
                height={NODE_H}
                rx={8}
                ry={8}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={2}
              />
              <text
                x={pos.x + NODE_W / 2}
                y={pos.y + 16}
                textAnchor="middle"
                fontSize={9}
                fontWeight="600"
                fill={colors.text}
              >
                {pos.skill.id}
              </text>
              <text
                x={pos.x + NODE_W / 2}
                y={pos.y + 27}
                textAnchor="middle"
                fontSize={8}
                fill="#475569"
              >
                {pos.skill.name.length > 18 ? pos.skill.name.slice(0, 17) + '…' : pos.skill.name}
              </text>
              <text
                x={pos.x + NODE_W / 2}
                y={pos.y + 39}
                textAnchor="middle"
                fontSize={8}
                fill="#64748b"
                fontStyle="italic"
              >
                ELO {pos.rating}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function SkillsPage() {
  const router = useRouter();
  const [skillRatings, setSkillRatings] = useState<SkillRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sessions?studentId=${DEMO_STUDENT_ID}&skillRatings=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.skill_ratings) setSkillRatings(data.skill_ratings);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Back */}
      <Link
        href="/progress"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 no-underline font-medium"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Progress
      </Link>

      <div>
        <h1 className="text-2xl font-black text-slate-900">Full Skill Map</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Your mastery level across all SAT skills. Click any skill to drill it.
        </p>
      </div>

      {/* Full skill map */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <SkillMap
          skillRatings={skillRatings}
          onSkillClick={(skill) => router.push(`/study?subSkillId=${skill}`)}
        />
      </div>

      {/* Prerequisite tree — Math only */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
            Math Skill Prerequisites Tree
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Arrows show skill prerequisites. Master foundational skills first.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap mb-4">
          <span className="text-xs text-slate-500 font-medium">Mastery:</span>
          {(
            [
              ['developing', '#fee2e2', '#fca5a5', 'Developing (<1100)'],
              ['progressing', '#fef9c3', '#fde047', 'Progressing (1100+)'],
              ['proficient', '#dcfce7', '#86efac', 'Proficient (1300+)'],
              ['mastered', '#fef3c7', '#fcd34d', 'Mastered (1500+)'],
            ] as const
          ).map(([key, fill, stroke, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div
                className="w-4 h-4 rounded border-2 shrink-0"
                style={{ backgroundColor: fill, borderColor: stroke }}
              />
              <span className="text-xs text-slate-600">{label}</span>
            </div>
          ))}
        </div>

        <SkillTreeSVG skillRatings={skillRatings} />
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            ['developing', 'Developing', 'bg-red-50 border-red-200', 'text-red-700'],
            ['progressing', 'Progressing', 'bg-yellow-50 border-yellow-200', 'text-yellow-700'],
            ['proficient', 'Proficient', 'bg-green-50 border-green-200', 'text-green-700'],
            ['mastered', 'Mastered', 'bg-amber-50 border-amber-200', 'text-amber-700'],
          ] as const
        ).map(([level, label, bg, text]) => {
          const count = SUB_SKILLS.filter((s) => {
            const r = skillRatings.find((r) => r.sub_skill_id === s.id);
            return getMasteryLevel(r?.elo_rating ?? 1000) === level;
          }).length;
          return (
            <div key={level} className={`rounded-xl border-2 p-4 text-center ${bg}`}>
              <p className={`text-3xl font-black ${text}`}>{count}</p>
              <p className="text-xs text-slate-600 mt-0.5 font-medium">{label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
