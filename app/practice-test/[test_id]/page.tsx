'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Flag,
  ChevronRight,
  ChevronLeft,
  Calculator,
  BookOpen,
  X,
  Monitor,
  AlertTriangle,
  Trophy,
  Loader2,
  Strikethrough,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { TimerWithBar } from '@/components/timer';
import { DesmosEmbed } from '@/components/desmos-embed';
import { AnnotationToolbar } from '@/components/annotation-toolbar';
import type { Question, Passage } from '@/types';

import { DEMO_STUDENT_ID } from '@/lib/constants';

// SAT module structure
const MODULES = [
  { id: 'rw1', label: 'Reading & Writing — Module 1', section: 'reading_writing' as const, questions: 27, minutes: 32 },
  { id: 'rw2', label: 'Reading & Writing — Module 2', section: 'reading_writing' as const, questions: 27, minutes: 32 },
  { id: 'break', label: 'Break', section: null, questions: 0, minutes: 10 },
  { id: 'math1', label: 'Math — Module 1', section: 'math' as const, questions: 22, minutes: 35 },
  { id: 'math2', label: 'Math — Module 2', section: 'math' as const, questions: 22, minutes: 35 },
];

const MATH_FORMULAS = `
**Area Formulas**
• Circle: A = πr²  |  C = 2πr
• Triangle: A = ½bh
• Rectangle: A = lw
• Trapezoid: A = ½(b₁+b₂)h

**Volume Formulas**
• Rectangular prism: V = lwh
• Cylinder: V = πr²h
• Sphere: V = (4/3)πr³
• Cone: V = (1/3)πr²h
• Pyramid: V = (1/3)lwh

**Special Right Triangles**
• 3-4-5 and multiples
• 5-12-13 and multiples
• 30-60-90: sides x, x√3, 2x
• 45-45-90: sides x, x, x√2

**Pythagorean Theorem**
• a² + b² = c²

**Quadratic Formula**
• x = (-b ± √(b²-4ac)) / 2a

**Other**
• Number of degrees in a circle: 360°
• Number of radians in a circle: 2π
`;

interface QuestionState {
  answer: string;
  isFlagged: boolean;
}

function SmallViewportWarning() {
  const [show, setShow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  if (!show) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-2 flex items-center gap-2 text-sm">
      <Monitor className="h-4 w-4 shrink-0" />
      <span>For the best test experience, use a desktop or laptop (1024px+ width recommended).</span>
      <button onClick={() => setShow(false)} className="ml-auto">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function QuestionGrid({
  total,
  current,
  answered,
  flagged,
  onJump,
}: {
  total: number;
  current: number;
  answered: Set<number>;
  flagged: Set<number>;
  onJump: (idx: number) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const isAnswered = answered.has(i);
        const isFlagged = flagged.has(i);
        const isCurrent = i === current;
        return (
          <button
            key={i}
            onClick={() => onJump(i)}
            className={`
              relative h-8 w-full rounded-md text-xs font-bold border-2 transition-colors
              ${isCurrent
                ? 'bg-blue-600 border-blue-600 text-white'
                : isAnswered
                ? 'bg-green-100 border-green-300 text-green-800'
                : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'}
            `}
          >
            {i + 1}
            {isFlagged && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function ActivePracticeTestPage() {
  useParams();
  const router = useRouter();

  const [moduleIndex, setModuleIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [passages, setPassages] = useState<Map<string, Passage>>(new Map());
  const [questionStates, setQuestionStates] = useState<Map<number, QuestionState>>(new Map());
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [answeredIds] = useState<Set<string>>(new Set());

  const [showCalculator, setShowCalculator] = useState(false);
  const [showFormulas, setShowFormulas] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [showEndSummary, setShowEndSummary] = useState(false);
  const [crossoutMode, setCrossoutMode] = useState(false);

  const currentModule = MODULES[moduleIndex];
  const isMathModule = currentModule.section === 'math';
  const isBreak = currentModule.id === 'break';

  const answered = new Set<number>(
    [...(questionStates.entries())]
      .filter(([, s]) => s.answer)
      .map(([i]) => i)
  );
  const flagged = new Set<number>(
    [...(questionStates.entries())]
      .filter(([, s]) => s.isFlagged)
      .map(([i]) => i)
  );

  const currentQuestion = questions[questionIndex] ?? null;
  const currentPassage = currentQuestion?.passage_id
    ? passages.get(currentQuestion.passage_id) ?? null
    : null;
  const currentState = questionStates.get(questionIndex);

  // Load questions for current module
  useEffect(() => {
    if (isBreak || !currentModule.section) return;
    setLoadingQuestions(true);
    setQuestions([]);
    setQuestionIndex(0);

    const loadedIds = [...answeredIds].join(',');
    const excludeParam = loadedIds ? `&excludeIds=${loadedIds}` : '';

    // Fetch all module questions
    Promise.all(
      Array.from({ length: currentModule.questions }, () =>
        fetch(
          `/api/questions?studentId=${DEMO_STUDENT_ID}&section=${currentModule.section}${excludeParam}`
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => ({ q: data?.question ?? data, p: data?.passage ?? null }))
          .catch(() => ({ q: null, p: null }))
      )
    )
      .then((results) => {
        const qs: Question[] = [];
        const passMap = new Map<string, Passage>(passages);
        for (const r of results) {
          if (r.q) {
            qs.push(r.q);
            if (r.p) passMap.set(r.q.passage_id ?? '', r.p);
          }
        }
        setQuestions(qs);
        setPassages(passMap);
      })
      .catch(() => {})
      .finally(() => setLoadingQuestions(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleIndex]);

  const handleAnswer = (letter: string) => {
    setQuestionStates((prev) => {
      const next = new Map(prev);
      const existing = next.get(questionIndex) ?? { answer: '', isFlagged: false };
      next.set(questionIndex, { ...existing, answer: letter });
      return next;
    });
  };

  const toggleFlag = () => {
    setQuestionStates((prev) => {
      const next = new Map(prev);
      const existing = next.get(questionIndex) ?? { answer: '', isFlagged: false };
      next.set(questionIndex, { ...existing, isFlagged: !existing.isFlagged });
      return next;
    });
  };

  const goNext = () => {
    if (questionIndex < currentModule.questions - 1) {
      setQuestionIndex(questionIndex + 1);
    }
  };

  const goPrev = () => {
    if (questionIndex > 0) {
      setQuestionIndex(questionIndex - 1);
    }
  };

  const handleModuleEnd = () => {
    const nextIdx = moduleIndex + 1;
    if (nextIdx >= MODULES.length) {
      setShowEndSummary(true);
    } else if (MODULES[nextIdx].id === 'break') {
      setShowBreak(true);
    } else {
      setModuleIndex(nextIdx);
      setQuestionIndex(0);
      setQuestionStates(new Map());
    }
  };

  const handleBreakDone = () => {
    setShowBreak(false);
    setModuleIndex(moduleIndex + 1);
    setQuestionIndex(0);
    setQuestionStates(new Map());
  };

  const totalAnswered = answered.size;
  const totalQuestions = currentModule.questions;
  const pctAnswered = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0;

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      <SmallViewportWarning />

      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-2.5 bg-slate-900 text-white border-b border-slate-700">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-300 truncate">{currentModule.label}</p>
        </div>

        <div className="flex items-center gap-3">
          {!isBreak && (
            <TimerWithBar
              totalSeconds={currentModule.minutes * 60}
              onTimeUp={handleModuleEnd}
              onWarning={() => setShowWarning(true)}
              isPaused={isBreak}
            />
          )}

          {/* Math tools */}
          {isMathModule && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCalculator((v) => !v)}
                className="border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white text-xs"
              >
                <Calculator className="h-3.5 w-3.5 mr-1" />
                Calculator
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowFormulas((v) => !v)}
                className="border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white text-xs"
              >
                <BookOpen className="h-3.5 w-3.5 mr-1" />
                Reference
              </Button>
            </>
          )}

          {/* Crossout toggle for RW */}
          {!isMathModule && !isBreak && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCrossoutMode((v) => !v)}
              className={`border-slate-600 text-xs hover:bg-slate-700 ${crossoutMode ? 'bg-slate-700 text-white' : 'text-slate-200 hover:text-white'}`}
            >
              <Strikethrough className="h-3.5 w-3.5 mr-1" />
              Crossout
            </Button>
          )}
        </div>
      </div>

      {/* Break screen */}
      {(showBreak || isBreak) && (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="text-center space-y-5 max-w-md px-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Trophy className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">Break Time!</h2>
              <p className="text-slate-600 mt-2 text-sm leading-relaxed">
                Great work on the Reading & Writing sections. You have 10 minutes before
                the Math section begins. Step away, stretch, and recharge.
              </p>
            </div>
            <TimerWithBar
              totalSeconds={10 * 60}
              onTimeUp={handleBreakDone}
              isPaused={false}
            />
            <Button
              onClick={handleBreakDone}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              Start Math Section
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Main test layout */}
      {!showBreak && !isBreak && (
        <div className="flex flex-1 min-h-0">
          {/* Question nav sidebar */}
          <div className="w-56 shrink-0 border-r border-slate-200 flex flex-col bg-slate-50 p-3 gap-3 overflow-y-auto">
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Questions
              </p>
              <div className="mb-2">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{totalAnswered}/{totalQuestions} answered</span>
                  <span>{pctAnswered}%</span>
                </div>
                <Progress value={pctAnswered} className="h-1" />
              </div>
              <QuestionGrid
                total={Math.min(totalQuestions, questions.length || totalQuestions)}
                current={questionIndex}
                answered={answered}
                flagged={flagged}
                onJump={setQuestionIndex}
              />
            </div>

            {/* Legend */}
            <div className="space-y-1 pt-2 border-t border-slate-200">
              {[
                { color: 'bg-blue-600 border-blue-600', label: 'Current' },
                { color: 'bg-green-100 border-green-300', label: 'Answered' },
                { color: 'bg-white border-slate-200', label: 'Unanswered' },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded border-2 shrink-0 ${l.color}`} />
                  <span className="text-[11px] text-slate-500">{l.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="relative w-4 h-4 shrink-0">
                  <span className="w-4 h-4 rounded border-2 bg-white border-slate-200 absolute inset-0" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full" />
                </span>
                <span className="text-[11px] text-slate-500">Flagged</span>
              </div>
            </div>

            {/* Submit module */}
            <div className="mt-auto pt-3 border-t border-slate-200">
              <Button
                onClick={handleModuleEnd}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold"
                size="sm"
              >
                Submit Module
              </Button>
            </div>
          </div>

          {/* Question + passage area */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {loadingQuestions ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto" />
                  <p className="text-slate-500 text-sm">Loading questions...</p>
                </div>
              </div>
            ) : currentQuestion ? (
              <div className="flex flex-1 min-h-0">
                {/* Passage */}
                {currentPassage && (
                  <div className="w-1/2 flex flex-col border-r border-slate-200 bg-white">
                    <div className="shrink-0 px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Passage
                      </span>
                      {!isMathModule && (
                        <AnnotationToolbar
                          onHighlight={() => {}}
                          onCrossOut={() => {}}
                          onClear={() => {}}
                        />
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto px-5 py-4">
                      <p className="text-sm leading-relaxed text-slate-700 passage-text whitespace-pre-wrap">
                        {currentPassage.passage_text}
                      </p>
                    </div>
                  </div>
                )}

                {/* Question */}
                <div className={`flex flex-col ${currentPassage ? 'w-1/2' : 'w-full'} bg-white`}>
                  {/* Question header */}
                  <div className="shrink-0 flex items-center justify-between px-5 py-2.5 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-700">
                        Question {questionIndex + 1}
                        <span className="text-slate-400 font-normal"> / {totalQuestions}</span>
                      </span>
                    </div>
                    <button
                      onClick={toggleFlag}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        currentState?.isFlagged
                          ? 'bg-amber-100 border-amber-400 text-amber-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-amber-50'
                      }`}
                    >
                      <Flag className="h-3.5 w-3.5" fill={currentState?.isFlagged ? 'currentColor' : 'none'} />
                      {currentState?.isFlagged ? 'Flagged' : 'Flag for Review'}
                    </button>
                  </div>

                  {/* Question content */}
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    <p className="text-base leading-relaxed text-slate-800 font-medium">
                      {currentQuestion.question_text}
                    </p>

                    {/* Answer choices */}
                    <div className="space-y-2.5">
                      {Object.entries(currentQuestion.answer_choices)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([letter, text]) => {
                          const isSelected = currentState?.answer === letter;
                          return (
                            <button
                              key={letter}
                              onClick={() => handleAnswer(letter)}
                              className={`
                                w-full text-left px-4 py-3 rounded-lg border-2 transition-all duration-100
                                font-medium text-sm flex items-start gap-3
                                ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 text-slate-800'
                                }
                              `}
                            >
                              <span
                                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-500 text-white'
                                    : 'border-slate-300 text-slate-500'
                                }`}
                              >
                                {letter}
                              </span>
                              <span className="flex-1 pt-0.5">{text}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goPrev}
                      disabled={questionIndex === 0}
                      className="border-slate-200 text-slate-600"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>

                    {questionIndex < totalQuestions - 1 ? (
                      <Button
                        size="sm"
                        onClick={goNext}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={handleModuleEnd}
                        className="bg-slate-800 hover:bg-slate-900 text-white font-semibold"
                      >
                        Submit Module
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-slate-400 text-sm">No question available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desmos Calculator — uses its own floating panel */}
      <DesmosEmbed isVisible={showCalculator} onClose={() => setShowCalculator(false)} />

      {/* Reference sheet modal */}
      <Dialog open={showFormulas} onOpenChange={setShowFormulas}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">SAT Math Reference Sheet</h2>
            <div className="prose prose-sm max-w-none">
              <pre className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-lg p-4 border border-slate-200 font-mono">
                {MATH_FORMULAS}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 5-minute warning modal */}
      <Dialog open={showWarning} onOpenChange={setShowWarning}>
        <DialogContent className="max-w-sm">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">5 Minutes Remaining</h2>
              <p className="text-slate-500 text-sm mt-1">
                Wrap up your remaining questions and submit the module.
              </p>
            </div>
            <Button
              onClick={() => setShowWarning(false)}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold"
            >
              Got it, keep going
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* End of test summary */}
      <Dialog open={showEndSummary} onOpenChange={() => {}}>
        <DialogContent className="max-w-md">
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3">
                <Trophy className="h-8 w-8 text-purple-600" />
              </div>
              <h2 className="text-xl font-black text-slate-900">Test Complete!</h2>
              <p className="text-slate-500 text-sm mt-1">
                You finished all 4 modules. Here&apos;s your preliminary score estimate.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-slate-900">--</p>
                <p className="text-xs text-slate-500 mt-0.5">Total</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-blue-700">--</p>
                <p className="text-xs text-slate-500 mt-0.5">R&W</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-purple-700">--</p>
                <p className="text-xs text-slate-500 mt-0.5">Math</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              Score calculation in progress. Visit the Insights page for a detailed wrong answer analysis.
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-slate-200"
                onClick={() => router.push('/')}
              >
                Dashboard
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                onClick={() => router.push('/insights')}
              >
                View Analysis
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
