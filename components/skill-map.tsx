'use client';

import type { SkillRating, SubSkillId } from '@/types';
import { SUB_SKILLS, getMasteryLevel } from '@/lib/constants';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SkillMapProps {
  skillRatings: SkillRating[];
  onSkillClick: (skillId: SubSkillId) => void;
}

const MASTERY_BG = {
  developing: 'bg-red-100 border-red-300 hover:bg-red-200',
  progressing: 'bg-yellow-100 border-yellow-300 hover:bg-yellow-200',
  proficient: 'bg-green-100 border-green-300 hover:bg-green-200',
  mastered: 'bg-amber-100 border-amber-300 hover:bg-amber-200',
} as const;

const MASTERY_DOT = {
  developing: 'bg-red-500',
  progressing: 'bg-yellow-500',
  proficient: 'bg-green-500',
  mastered: 'bg-amber-500',
} as const;

const MASTERY_LABEL_COLOR = {
  developing: 'text-red-700',
  progressing: 'text-yellow-700',
  proficient: 'text-green-700',
  mastered: 'text-amber-700',
} as const;

const DEFAULT_ELO = 1000;

export function SkillMap({ skillRatings, onSkillClick }: SkillMapProps) {
  const ratingMap = new Map<string, SkillRating>(
    skillRatings.map((r) => [r.sub_skill_id, r])
  );

  // Group skills by section then domain
  const groupedRW = SUB_SKILLS.filter((s) => s.section === 'reading_writing').reduce<
    Record<string, typeof SUB_SKILLS>
  >((acc, s) => {
    if (!acc[s.domain]) acc[s.domain] = [];
    acc[s.domain].push(s);
    return acc;
  }, {});

  const groupedMath = SUB_SKILLS.filter((s) => s.section === 'math').reduce<
    Record<string, typeof SUB_SKILLS>
  >((acc, s) => {
    if (!acc[s.domain]) acc[s.domain] = [];
    acc[s.domain].push(s);
    return acc;
  }, {});

  const renderSkillCell = (skill: (typeof SUB_SKILLS)[number]) => {
    const rating = ratingMap.get(skill.id);
    const elo = rating?.elo_rating ?? DEFAULT_ELO;
    const mastery = getMasteryLevel(elo);
    const attempted = rating?.questions_attempted ?? 0;

    return (
      <TooltipProvider key={skill.id} delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onSkillClick(skill.id)}
              className={`
                group relative flex flex-col gap-1 p-3 rounded-lg border-2 text-left
                transition-all duration-150 cursor-pointer w-full
                ${MASTERY_BG[mastery]}
              `}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-xs font-semibold text-slate-700 leading-snug line-clamp-2">
                  {skill.name}
                </span>
                <span
                  className={`flex-shrink-0 w-2.5 h-2.5 rounded-full mt-0.5 ${MASTERY_DOT[mastery]}`}
                />
              </div>
              <div className="flex items-center justify-between mt-auto">
                <span className={`text-xs font-medium capitalize ${MASTERY_LABEL_COLOR[mastery]}`}>
                  {mastery}
                </span>
                <span className="text-xs text-slate-400">{skill.id}</span>
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-sm">{skill.name}</p>
              <p>
                Elo rating:{' '}
                <span className="font-bold">{elo}</span>
                {!rating?.is_calibrated && (
                  <span className="ml-1 text-slate-400">(uncalibrated)</span>
                )}
              </p>
              <p>
                Mastery:{' '}
                <span className={`font-semibold capitalize ${MASTERY_LABEL_COLOR[mastery]}`}>
                  {mastery}
                </span>
              </p>
              {attempted > 0 && (
                <p>
                  {rating!.questions_correct}/{attempted} correct (
                  {Math.round((rating!.questions_correct / attempted) * 100)}%)
                </p>
              )}
              {attempted === 0 && <p className="text-slate-400">Not yet practiced</p>}
              <p className="text-slate-400 pt-0.5">Click to drill this skill</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const renderSection = (
    title: string,
    grouped: Record<string, typeof SUB_SKILLS>,
    sectionColor: string
  ) => (
    <div className="space-y-4">
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${sectionColor}`}>
        {title}
      </div>
      {Object.entries(grouped).map(([domain, skills]) => (
        <div key={domain} className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider pl-1">
            {domain}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {skills.map(renderSkillCell)}
          </div>
        </div>
      ))}
    </div>
  );

  // Legend
  const legend = (
    <div className="flex items-center gap-4 flex-wrap">
      <span className="text-xs text-slate-500 font-medium">Mastery:</span>
      {(
        [
          ['developing', 'bg-red-500', 'Developing (<1100)'],
          ['progressing', 'bg-yellow-500', 'Progressing (1100+)'],
          ['proficient', 'bg-green-500', 'Proficient (1300+)'],
          ['mastered', 'bg-amber-500', 'Mastered (1500+)'],
        ] as const
      ).map(([key, dot, label]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
          <span className="text-xs text-slate-600">{label}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {legend}
      {renderSection(
        'Reading & Writing',
        groupedRW,
        'bg-blue-100 text-blue-800'
      )}
      {renderSection(
        'Math',
        groupedMath,
        'bg-purple-100 text-purple-800'
      )}
    </div>
  );
}
