'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap,
  BookOpen,
  Timer,
  ClipboardList,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SUB_SKILLS , DEMO_STUDENT_ID } from '@/lib/constants';
import type { SessionType, SubSkillId } from '@/types';
import { toast } from 'sonner';


interface SessionCard {
  type: SessionType;
  icon: React.ReactNode;
  title: string;
  description: string;
  duration: string;
  questionCount: string;
  color: string;
  iconBg: string;
  recommended?: boolean;
}

const SESSION_CARDS: SessionCard[] = [
  {
    type: 'quick_drill',
    icon: <Zap className="h-6 w-6 text-green-600" />,
    title: 'Quick Drill',
    description: 'Focused practice on a single skill. Great for targeting specific weaknesses in a short burst.',
    duration: '10 min',
    questionCount: '10 questions',
    color: 'border-green-200 hover:border-green-400',
    iconBg: 'bg-green-100',
    recommended: true,
  },
  {
    type: 'study_session',
    icon: <BookOpen className="h-6 w-6 text-blue-600" />,
    title: 'Study Session',
    description: 'Interleaved Math and R&W questions — mixing subjects builds the mental flexibility the real SAT requires. AI adjusts difficulty based on your performance.',
    duration: '25–45 min',
    questionCount: 'Adaptive',
    color: 'border-blue-200 hover:border-blue-400',
    iconBg: 'bg-blue-100',
  },
  {
    type: 'timed_section',
    icon: <Timer className="h-6 w-6 text-orange-600" />,
    title: 'Timed Section',
    description: 'Full SAT section under realistic time pressure. No hints or explanations during the session.',
    duration: '32–35 min',
    questionCount: '22–27 questions',
    color: 'border-orange-200 hover:border-orange-400',
    iconBg: 'bg-orange-100',
  },
  {
    type: 'full_practice_test',
    icon: <ClipboardList className="h-6 w-6 text-purple-600" />,
    title: 'Full Practice Test',
    description: 'Complete SAT simulation with all 4 modules, 10-minute break, and authentic timing.',
    duration: '2+ hours',
    questionCount: '98 questions',
    color: 'border-purple-200 hover:border-purple-400',
    iconBg: 'bg-purple-100',
  },
];

export default function StudyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<SessionType | null>(null);
  const [focusSkill, setFocusSkill] = useState<SubSkillId | ''>('');

  const startSession = async (type: SessionType) => {
    if (type === 'quick_drill' && !focusSkill) {
      toast.error('Please select a skill to focus on for Quick Drill');
      return;
    }

    if (type === 'full_practice_test') {
      router.push('/practice-test');
      return;
    }

    setLoading(type);
    try {
      const body: Record<string, unknown> = {
        student_id: DEMO_STUDENT_ID,
        session_type: type,
      };
      if (type === 'quick_drill' && focusSkill) {
        body.sub_skill_focus = focusSkill;
      }

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Failed to create session (${res.status})`);
      }

      const session = await res.json();
      const sessionId = session.id ?? session.session_id;
      router.push(`/study/${sessionId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not start session';
      toast.error(message);
      setLoading(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900">Start a Study Session</h1>
        <p className="text-slate-500 text-sm mt-1">
          Choose the type of practice that fits your goals today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SESSION_CARDS.map((card) => (
          <div
            key={card.type}
            className={`
              relative flex flex-col gap-4 p-6 bg-white rounded-xl border-2 shadow-sm
              transition-all duration-150 ${card.color}
            `}
          >
            {card.recommended && (
              <div className="absolute -top-2.5 right-4">
                <span className="bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shadow-sm">
                  Recommended
                </span>
              </div>
            )}

            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${card.iconBg}`}>
                {card.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-slate-900 mb-0.5">{card.title}</h2>
                <p className="text-sm text-slate-500 leading-relaxed">{card.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-xs">
                {card.duration}
              </Badge>
              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-xs">
                {card.questionCount}
              </Badge>
            </div>

            {/* Quick Drill skill selector */}
            {card.type === 'quick_drill' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">
                  Focus skill <span className="text-red-500">*</span>
                </label>
                <Select
                  value={focusSkill}
                  onValueChange={(val) => setFocusSkill(val as SubSkillId)}
                >
                  <SelectTrigger className="w-full border-slate-200 text-sm">
                    <SelectValue placeholder="Select a skill to drill..." />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Reading & Writing */}
                    <SelectItem value="__rw_header__" disabled className="font-bold text-slate-400 text-xs uppercase tracking-wide">
                      Reading & Writing
                    </SelectItem>
                    {SUB_SKILLS.filter((s) => s.section === 'reading_writing').map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.id})
                      </SelectItem>
                    ))}
                    {/* Math */}
                    <SelectItem value="__math_header__" disabled className="font-bold text-slate-400 text-xs uppercase tracking-wide">
                      Math
                    </SelectItem>
                    {SUB_SKILLS.filter((s) => s.section === 'math').map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={() => startSession(card.type)}
              disabled={loading !== null}
              className={`w-full font-semibold ${
                card.type === 'quick_drill'
                  ? 'bg-green-600 hover:bg-green-700'
                  : card.type === 'study_session'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : card.type === 'timed_section'
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-purple-600 hover:bg-purple-700'
              } text-white disabled:opacity-50`}
            >
              {loading === card.type ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  Start {card.title}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="text-sm font-bold text-blue-800 mb-2">Study Tips</h3>
        <ul className="space-y-1.5">
          {[
            'Quick Drills work best when targeting a specific skill from your Insights page.',
            'Study Sessions adapt to your performance — stay focused for the best results.',
            'Timed Sections build real test stamina. Simulate actual SAT conditions.',
            'Full Practice Tests should be taken every 2–3 weeks to track score progress.',
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-blue-700">
              <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
