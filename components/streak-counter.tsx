'use client';

import type { DailyActivity } from '@/types';
import { useMemo } from 'react';
import { toLocalDateKey } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface StreakCounterProps {
  currentStreak: number;
  dailyActivity: DailyActivity[];
  weeklyGoal: number;
}

const MILESTONE_THRESHOLDS = [3, 7, 14, 30, 60, 100];

function getMilestoneLabel(days: number): string {
  if (days >= 100) return '100-day Legend';
  if (days >= 60) return '60-day Master';
  if (days >= 30) return '30-day Expert';
  if (days >= 14) return '2-week Scholar';
  if (days >= 7) return '1-week Star';
  if (days >= 3) return '3-day Starter';
  return '';
}

function getActivityLevel(questions: number): string {
  if (questions === 0) return 'none';
  if (questions < 5) return 'light';
  if (questions < 15) return 'moderate';
  if (questions < 30) return 'strong';
  return 'intense';
}

const ACTIVITY_BG: Record<string, string> = {
  none: 'bg-slate-100',
  light: 'bg-green-200',
  moderate: 'bg-green-400',
  strong: 'bg-green-600',
  intense: 'bg-green-800',
};

function getDatesForGrid(): Date[] {
  // Build 12-week grid (84 days) ending today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates: Date[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d);
  }
  return dates;
}

function toDateKey(d: Date): string {
  return toLocalDateKey(d);
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function StreakCounter({
  currentStreak,
  dailyActivity,
  weeklyGoal,
}: StreakCounterProps) {
  const activityMap = useMemo(() => {
    const map = new Map<string, DailyActivity>();
    for (const a of dailyActivity) {
      map.set(a.activity_date.slice(0, 10), a);
    }
    return map;
  }, [dailyActivity]);

  const gridDates = useMemo(() => getDatesForGrid(), []);

  // Pad the start so the grid aligns to week columns
  const firstDay = gridDates[0].getDay(); // 0=Sun
  const paddedBefore = firstDay; // empty cells at start

  // Build week columns: each column is a week (7 days), left = oldest
  const weeks: (Date | null)[][] = [];
  let col: (Date | null)[] = Array(paddedBefore).fill(null);
  for (const d of gridDates) {
    col.push(d);
    if (col.length === 7) {
      weeks.push(col);
      col = [];
    }
  }
  if (col.length > 0) {
    while (col.length < 7) col.push(null);
    weeks.push(col);
  }

  // Current week progress
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Sunday

  let daysThisWeek = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = toDateKey(d);
    const act = activityMap.get(key);
    if (act?.streak_qualifying) daysThisWeek++;
  }
  const weekProgressPct = Math.min(100, Math.round((daysThisWeek / weeklyGoal) * 100));

  // Milestones earned
  const earnedMilestones = MILESTONE_THRESHOLDS.filter((m) => currentStreak >= m);
  const nextMilestone = MILESTONE_THRESHOLDS.find((m) => m > currentStreak);

  return (
    <div className="space-y-5">
      {/* Streak display */}
      <div className="flex items-start gap-6">
        <div className="text-center">
          <div className="flex items-center gap-2 justify-center">
            <span className="text-5xl font-black text-orange-500">{currentStreak}</span>
          </div>
          <p className="text-sm font-semibold text-slate-600 mt-0.5">Day Streak</p>
          <p className="text-xs text-slate-400">
            {currentStreak === 0
              ? 'Start today!'
              : currentStreak === 1
              ? 'Keep it going!'
              : `${currentStreak} days strong`}
          </p>
        </div>

        <div className="flex-1 space-y-3">
          {/* Weekly progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">This week</span>
              <span className="text-slate-500">
                {daysThisWeek}/{weeklyGoal} days
              </span>
            </div>
            <Progress value={weekProgressPct} className="h-2" />
          </div>

          {/* Next milestone */}
          {nextMilestone && (
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-orange-600">
                {nextMilestone - currentStreak} day{nextMilestone - currentStreak !== 1 ? 's' : ''}
              </span>{' '}
              until {getMilestoneLabel(nextMilestone)}
            </p>
          )}

          {/* Milestone badges */}
          {earnedMilestones.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {earnedMilestones.map((m) => (
                <Badge
                  key={m}
                  variant="outline"
                  className="text-xs bg-orange-50 border-orange-200 text-orange-700 px-2 py-0.5"
                >
                  {getMilestoneLabel(m)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Calendar heatmap */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
          12-Week Activity
        </p>
        <div className="overflow-x-auto">
          <div className="flex gap-1 min-w-fit">
            {/* Day labels column */}
            <div className="flex flex-col gap-1 mr-0.5">
              <div className="h-4" /> {/* Spacer for month labels */}
              {DAY_LABELS.map((day, i) => (
                <div
                  key={day}
                  className={`h-4 text-[10px] text-slate-400 flex items-center ${
                    i % 2 === 0 ? '' : 'invisible'
                  }`}
                  style={{ width: 28 }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Week columns */}
            <TooltipProvider delayDuration={100}>
              {weeks.map((week, wi) => {
                // Month label for this column
                const firstReal = week.find((d) => d !== null);
                const showMonth =
                  firstReal &&
                  (wi === 0 || firstReal.getDate() <= 7);
                const monthLabel = showMonth
                  ? firstReal!.toLocaleString('default', { month: 'short' })
                  : '';

                return (
                  <div key={wi} className="flex flex-col gap-1">
                    {/* Month label */}
                    <div className="h-4 text-[10px] text-slate-400 flex items-center">
                      {monthLabel}
                    </div>
                    {week.map((date, di) => {
                      if (!date) {
                        return <div key={di} className="w-4 h-4" />;
                      }
                      const key = toDateKey(date);
                      const activity = activityMap.get(key);
                      const questions = activity?.questions_answered ?? 0;
                      const level = getActivityLevel(questions);
                      const isToday = toDateKey(date) === toDateKey(new Date());

                      return (
                        <Tooltip key={di}>
                          <TooltipTrigger asChild>
                            <div
                              className={`
                                w-4 h-4 rounded-sm cursor-default transition-transform hover:scale-110
                                ${ACTIVITY_BG[level]}
                                ${isToday ? 'ring-2 ring-orange-400 ring-offset-1' : ''}
                                ${activity?.streak_qualifying ? 'ring-1 ring-green-400 ring-offset-[0.5px]' : ''}
                              `}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <div className="text-xs">
                              <p className="font-semibold">
                                {date.toLocaleDateString('default', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </p>
                              {questions > 0 ? (
                                <p>{questions} questions answered</p>
                              ) : (
                                <p className="text-slate-400">No activity</p>
                              )}
                              {activity?.streak_qualifying && (
                                <p className="text-green-600 font-medium">Streak day!</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                );
              })}
            </TooltipProvider>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-slate-400">Less</span>
          {['none', 'light', 'moderate', 'strong', 'intense'].map((level) => (
            <div key={level} className={`w-3.5 h-3.5 rounded-sm ${ACTIVITY_BG[level]}`} />
          ))}
          <span className="text-[10px] text-slate-400">More</span>
        </div>
      </div>
    </div>
  );
}
