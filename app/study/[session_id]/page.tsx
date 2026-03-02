'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronRight,
  StopCircle,
  Clock,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { QuestionCard } from '@/components/question-card';
import { ExplanationPanel } from '@/components/explanation-panel';
import type {
  Question,
  Passage,
  Session,
  ConfidenceLevel,
  MoodSignal,
  StudentContextProfile,
  ConversationMessage,
  SubSkillId,
} from '@/types';
import { SUB_SKILL_MAP, DEMO_STUDENT_ID, formatElapsed } from '@/lib/constants';
import { gridInAnswersMatch } from '@/lib/utils';
import { toast } from 'sonner';

const DUMMY_PROFILE: StudentContextProfile = {
  student_id: DEMO_STUDENT_ID,
  session_number: 1,
  current_predicted_score: { total: 1200, rw: 600, math: 600 },
  skill_ratings: {} as StudentContextProfile['skill_ratings'],
  top_3_weaknesses: [],
  recent_wrong_answers: [],
  session_state: {
    questions_answered: 0,
    accuracy_this_session: 0,
    current_mood_signal: 'neutral',
    consecutive_wrong: 0,
    time_in_session_minutes: 0,
  },
  learning_preferences: {
    preferred_explanation_style: 'step_by_step',
    socratic_mode: false,
  },
};

function FrustrationBanner({ signal }: { signal: 'frustrated' | null }) {
  if (!signal) return null;
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800">
      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
      <p>
        You&apos;ve gotten a few wrong in a row — that&apos;s totally normal. Take a breath, then let&apos;s break it down together.
      </p>
    </div>
  );
}

export default function ActiveStudySessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.session_id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Current question state
  const [question, setQuestion] = useState<Question | null>(null);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [tutorMode, setTutorMode] = useState<'socratic' | 'direct'>('direct');
  const [sessionHistory, setSessionHistory] = useState<ConversationMessage[]>([]);

  // Session stats
  const [questionCount, setQuestionCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);

  // Frustration detection
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
  const [frustrationSignal, setFrustrationSignal] = useState<'frustrated' | null>(null);
  const moodSignals = useRef<MoodSignal[]>([]);
  const subSkillsRef = useRef<Set<string>>(new Set());
  const elapsedSecondsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // End session state
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  // Timer — keep a ref in sync so fetchNextQuestion can read it without being in deps
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => {
        elapsedSecondsRef.current = s + 1;
        return s + 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Load session info
  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSession(data);
      })
      .catch(() => {})
      .finally(() => setSessionLoading(false));
  }, [sessionId]);

  // Fetch next question
  const fetchNextQuestion = useCallback(async () => {
    setQuestionLoading(true);
    setIsAnswered(false);
    setSelectedAnswer('');
    setQuestion(null);
    setPassage(null);

    const excludeParam = answeredIds.length > 0 ? `&excludeIds=${answeredIds.join(',')}` : '';
    const skillParam = session?.sub_skill_focus ? `&subSkillId=${session.sub_skill_focus}` : '';
    const sessionMins = Math.round(elapsedSecondsRef.current / 60);

    try {
      const res = await fetch(
        `/api/questions?studentId=${DEMO_STUDENT_ID}${excludeParam}${skillParam}&sessionMinutes=${sessionMins}`
      );
      if (!res.ok) throw new Error('Failed to fetch question');
      const data = await res.json();
      const q: Question = data.question ?? data;
      const p: Passage | null = data.passage ?? null;
      setQuestion(q);
      setPassage(p);
      setQuestionStartTime(Date.now());
    } catch {
      toast.error('Could not load next question. Please try again.');
    } finally {
      setQuestionLoading(false);
    }
  }, [answeredIds, session]);

  // Auto-fetch first question once session loads
  const hasFetchedFirst = useRef(false);
  useEffect(() => {
    if (!sessionLoading && !hasFetchedFirst.current) {
      hasFetchedFirst.current = true;
      fetchNextQuestion();
    }
  }, [sessionLoading, fetchNextQuestion]);

  const handleAnswer = useCallback(
    async (answer: string, confidence: ConfidenceLevel | null) => {
      if (!question) return;
      const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);
      const isGridIn = Object.keys(question.answer_choices ?? {}).length === 0;
      const correct = isGridIn
        ? gridInAnswersMatch(answer, question.correct_answer)
        : answer === question.correct_answer;

      setSelectedAnswer(answer);
      setIsAnswered(true);
      setQuestionCount((c) => c + 1);
      setAnsweredIds((ids) => [...ids, question.question_id]);

      if (correct) {
        setCorrectCount((c) => c + 1);
        setConsecutiveWrong(0);
        setFrustrationSignal(null);
      } else {
        const newConsec = consecutiveWrong + 1;
        setConsecutiveWrong(newConsec);
        if (newConsec >= 3) {
          setFrustrationSignal('frustrated');
          moodSignals.current.push('consecutive_wrong');
        }
        if (timeSpent < 10) {
          moodSignals.current.push('rushing');
        }
      }

      // Track sub-skill for session stats
      if (question.sub_skill_id) subSkillsRef.current.add(question.sub_skill_id);

      // Update cross-question AI context (carried into the next ExplanationPanel init)
      setSessionHistory((prev) => [
        ...prev.slice(-8),
        {
          role: 'user' as const,
          content: `Previous question (${question.sub_skill_id}): "${question.question_text.slice(0, 120)}..." Student answered: "${answer}" (${correct ? 'correct' : 'incorrect'}). Correct answer: "${question.correct_answer}".`,
        },
      ]);

      // Record attempt
      try {
        const attemptRes = await fetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: DEMO_STUDENT_ID,
            session_id: sessionId,
            question_id: question.question_id,
            student_answer: answer,
            is_correct: correct,
            time_spent_seconds: timeSpent,
            confidence_level: confidence,
          }),
        });

        // Fire-and-forget: classify error type for wrong answers (powers Wrong Answer Insights)
        if (!correct && attemptRes.ok) {
          const { attempt } = await attemptRes.json();
          fetch('/api/claude/classify-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question,
              correctAnswer: question.correct_answer,
              studentAnswer: answer,
              timeSpentSeconds: timeSpent,
              confidenceLevel: confidence ?? 'okay',
              attemptId: attempt?.id,
            }),
          }).catch(() => {});
        }
      } catch {
        // non-critical
      }
    },
    [question, questionStartTime, consecutiveWrong, sessionId]
  );

  const handleEndSession = async () => {
    // Stop the timer immediately when the dialog opens
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSummaryLoading(true);
    setShowEndDialog(true);

    // Fire-and-forget: persist mood signals and sub-skills to the session row
    fetch('/api/sessions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        endedAt: new Date().toISOString(),
        moodSignals: [...new Set(moodSignals.current)],
        subSkillsPracticed: [...subSkillsRef.current],
      }),
    }).catch(() => {});

    // Fire-and-forget: regenerate score prediction with latest skill ratings
    fetch('/api/claude/predict-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: DEMO_STUDENT_ID }),
    }).catch(() => {});

    try {
      const res = await fetch('/api/claude/session-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          student_id: DEMO_STUDENT_ID,
          questions_answered: questionCount,
          questions_correct: correctCount,
          mood_signals: [...new Set(moodSignals.current)],
          elapsed_seconds: elapsedSeconds,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSessionSummary(data.summary?.trim() || null);
      }
    } catch {
      setSessionSummary(null);
    } finally {
      setSummaryLoading(false);
      setSessionEnded(true);
    }
  };

  const accuracy = questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0;
  const skillName = session?.sub_skill_focus
    ? (SUB_SKILL_MAP[session.sub_skill_focus as SubSkillId]?.name ?? session.sub_skill_focus)
    : null;

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-4 px-6 py-3 bg-white border-b border-slate-200 shadow-sm">
        {/* Session info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs shrink-0">
            {session?.session_type === 'quick_drill' ? 'Quick Drill' : 'Study Session'}
          </Badge>
          {skillName && (
            <span className="text-xs text-slate-500 truncate">
              Focus: <span className="font-medium text-slate-700">{skillName}</span>
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5 text-sm">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="font-mono text-slate-600 font-medium">
              {formatElapsed(elapsedSeconds)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-slate-700 font-medium">{correctCount}</span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-700 font-medium">{questionCount}</span>
          </div>
          {questionCount > 0 && (
            <div className="w-20">
              <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                <span>Accuracy</span>
                <span>{accuracy}%</span>
              </div>
              <Progress
                value={accuracy}
                className="h-1.5"
              />
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleEndSession}
          className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400 shrink-0"
        >
          <StopCircle className="h-4 w-4 mr-1.5" />
          End Session
        </Button>
      </div>

      {/* Frustration banner */}
      {frustrationSignal && (
        <div className="px-4 pt-3">
          <FrustrationBanner signal={frustrationSignal} />
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0 gap-0">
        {/* Question area */}
        <div
          className={`flex flex-col min-h-0 p-4 ${
            isAnswered ? 'w-1/2' : 'w-full'
          } transition-all duration-300`}
        >
          {questionLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto" />
                <p className="text-slate-500 text-sm">Loading next question...</p>
              </div>
            </div>
          ) : question ? (
            <div className="flex flex-col flex-1 min-h-0 gap-3">
              <QuestionCard
                question={question}
                passage={passage}
                onAnswer={handleAnswer}
                isAnswered={isAnswered}
                selectedAnswer={selectedAnswer}
                correctAnswer={question.correct_answer}
                timeSpentSeconds={Math.round((Date.now() - questionStartTime) / 1000)}
                questionNumber={questionCount + (isAnswered ? 0 : 1)}
              />

              {isAnswered && (
                <div className="flex justify-end">
                  <Button
                    onClick={fetchNextQuestion}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
                  >
                    Next Question
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <p className="text-slate-500">No question available</p>
                <Button onClick={fetchNextQuestion} variant="outline">
                  Try again
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Explanation panel (only after answer) */}
        {isAnswered && question && (
          <div className="w-1/2 flex flex-col p-4 pl-0 min-h-0">
            <ExplanationPanel
              question={question}
              studentAnswer={selectedAnswer}
              isCorrect={
                Object.keys(question.answer_choices ?? {}).length === 0
                  ? gridInAnswersMatch(selectedAnswer, question.correct_answer)
                  : selectedAnswer === question.correct_answer
              }
              tutorMode={tutorMode}
              onModeToggle={setTutorMode}
              studentProfile={DUMMY_PROFILE}
              sessionHistory={sessionHistory}
            />
          </div>
        )}
      </div>

      {/* End Session Dialog */}
      <Dialog open={showEndDialog} onOpenChange={(open) => {
        if (!open && sessionEnded) router.push('/');
        if (!open) setShowEndDialog(false);
      }}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">Session Complete</DialogTitle>
          <div className="space-y-5">
            {/* Summary header */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                <Trophy className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-black text-slate-900">Session Complete!</h2>
              {summaryLoading ? (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                  <p className="text-slate-500 text-sm">Generating your summary...</p>
                </div>
              ) : sessionSummary ? (
                <p className="text-slate-600 text-sm mt-2 leading-relaxed">{sessionSummary}</p>
              ) : (
                <p className="text-slate-500 text-sm mt-1">Great work pushing through today.</p>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-slate-900">{questionCount}</p>
                <p className="text-xs text-slate-500 mt-0.5">Questions</p>
              </div>
              <div className={`rounded-xl p-3 text-center ${
                questionCount === 0 ? 'bg-slate-50'
                : accuracy >= 80 ? 'bg-green-50'
                : accuracy >= 60 ? 'bg-yellow-50'
                : 'bg-red-50'
              }`}>
                <p className={`text-2xl font-black ${
                  questionCount === 0 ? 'text-slate-400'
                  : accuracy >= 80 ? 'text-green-700'
                  : accuracy >= 60 ? 'text-yellow-700'
                  : 'text-red-700'
                }`}>{questionCount === 0 ? '—' : `${accuracy}%`}</p>
                <p className="text-xs text-slate-500 mt-0.5">Accuracy</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-blue-700">{formatElapsed(elapsedSeconds)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Time</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-slate-200"
                onClick={() => router.push('/')}
              >
                Go to Dashboard
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                onClick={() => {
                  setShowEndDialog(false);
                  setSessionEnded(false);
                  fetchNextQuestion();
                }}
              >
                Keep Studying
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
