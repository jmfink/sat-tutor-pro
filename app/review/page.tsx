'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Loader2,
  BookOpen,
  Repeat,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { ReviewQueueItem, Question, Passage } from '@/types';
import { SUB_SKILL_MAP , DEMO_STUDENT_ID } from '@/lib/constants';
import { toLocalDateKey } from '@/lib/utils';


type ReviewMode = 'list' | 'active' | 'done';

function ReviewQueueRow({ item }: { item: ReviewQueueItem & { question?: Question } }) {
  const skill = SUB_SKILL_MAP[item.question?.sub_skill_id ?? ''];
  const dueDate = new Date(item.next_review_date);
  const isOverdue = dueDate < new Date();

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {skill && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] shrink-0">
              {skill.name}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={`text-[10px] shrink-0 ${
              isOverdue
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-green-50 text-green-700 border-green-200'
            }`}
          >
            {isOverdue ? 'Overdue' : 'Due today'}
          </Badge>
          {item.last_review_result !== undefined && (
            item.last_review_result
              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              : <XCircle className="h-3.5 w-3.5 text-red-400" />
          )}
        </div>
        {item.question?.question_text && (
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {item.question.question_text}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
          <span>Interval: {item.interval_days} day{item.interval_days !== 1 ? 's' : ''}</span>
          <span>Reviews: {item.review_count}</span>
          <span>
            Last reviewed:{' '}
            {dueDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ReviewQueuePage() {
  const router = useRouter();
  const [queueItems, setQueueItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ReviewMode>('list');

  // Active review state
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentPassage, setCurrentPassage] = useState<Passage | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  // Tracks how many cards have been reviewed in the current session so the
  // "cards due" count decreases in real time even before a full re-fetch.
  const [sessionReviewedCount, setSessionReviewedCount] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  useEffect(() => {
    // cache: 'no-store' ensures the browser never returns a stale count when
    // the user navigates away and back after completing a review session.
    fetch(`/api/review?studentId=${DEMO_STUDENT_ID}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const items: ReviewQueueItem[] = Array.isArray(data) ? data : data?.items ?? [];
        setQueueItems(items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fetchQuestionForItem = useCallback(async (item: ReviewQueueItem) => {
    setLoadingQuestion(true);
    setCurrentQuestion(null);
    setCurrentPassage(null);
    setSelectedAnswer('');
    setIsAnswered(false);

    try {
      const res = await fetch(`/api/questions?questionId=${item.question_id}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentQuestion(data.question ?? data);
        setCurrentPassage(data.passage ?? null);
        setQuestionStartTime(Date.now());
      } else {
        // Fallback: just show question ID
      }
    } catch {
      // ignore
    } finally {
      setLoadingQuestion(false);
    }
  }, []);

  const startReview = async () => {
    if (queueItems.length === 0) return;
    setMode('active');
    setCurrentItemIndex(0);
    setSessionCorrect(0);
    setSessionTotal(0);
    setSessionReviewedCount(0);
    await fetchQuestionForItem(queueItems[0]);
  };

  const handleAnswer = async (letter: string) => {
    if (isAnswered || !currentQuestion) return;
    const correct = letter === currentQuestion.correct_answer;
    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);

    setSelectedAnswer(letter);
    setIsAnswered(true);
    setIsCorrect(correct);
    setSessionTotal((t) => t + 1);
    if (correct) setSessionCorrect((c) => c + 1);

    // Record review result and optimistically mark card as reviewed so the
    // displayed count decreases immediately without waiting for a re-fetch.
    const item = queueItems[currentItemIndex];
    setSessionReviewedCount((c) => c + 1);
    try {
      await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: DEMO_STUDENT_ID,
          review_item_id: item.id,
          question_id: item.question_id,
          is_correct: correct,
          time_spent_seconds: timeSpent,
          local_date: toLocalDateKey(),
        }),
      });
    } catch {
      // non-critical
    }
  };

  const handleNext = async () => {
    const nextIndex = currentItemIndex + 1;
    if (nextIndex >= queueItems.length) {
      // Re-fetch the queue so the list view reflects the server's updated counts
      // (items rescheduled to future dates should no longer appear as "due").
      try {
        const res = await fetch(`/api/review?studentId=${DEMO_STUDENT_ID}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const items: ReviewQueueItem[] = Array.isArray(data) ? data : data?.items ?? [];
          setQueueItems(items);
        }
      } catch {
        // non-critical
      }
      setMode('done');
      return;
    }
    setCurrentItemIndex(nextIndex);
    await fetchQuestionForItem(queueItems[nextIndex]);
  };

  // Total items in the current session (stable for progress tracking).
  const sessionTotal_count = queueItems.length;
  // Cards still remaining after accounting for reviewed ones this session.
  const dueCount = Math.max(0, queueItems.length - sessionReviewedCount);
  const progressPct = mode === 'active' ? Math.round((sessionTotal / sessionTotal_count) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // List view
  if (mode === 'list') {
    return (
      <div className="p-6 max-w-4xl mx-auto w-full space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Review Queue</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Spaced repetition — review what you&apos;ve learned before you forget it.
            </p>
          </div>
        </div>

        {/* Stats banner */}
        <div className={`rounded-xl p-5 border-2 ${
          dueCount > 0
            ? 'bg-amber-50 border-amber-200'
            : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Clock className={`h-5 w-5 ${dueCount > 0 ? 'text-amber-600' : 'text-green-600'}`} />
                <p className={`text-2xl font-black ${dueCount > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                  {dueCount} {dueCount === 1 ? 'card' : 'cards'} due
                </p>
              </div>
              <p className={`text-sm ${dueCount > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                {dueCount > 0
                  ? `Reviewing now keeps your memory strong. Est. ${Math.ceil(dueCount * 0.5)} min.`
                  : 'You\'re all caught up! Check back tomorrow.'}
              </p>
            </div>
            {dueCount > 0 && (
              <Button
                onClick={startReview}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm shrink-0"
              >
                <Repeat className="h-4 w-4 mr-1.5" />
                Start Review Session
              </Button>
            )}
          </div>
        </div>

        {/* About spaced repetition */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700 leading-relaxed">
          <p className="font-semibold text-blue-800 mb-1">How it works:</p>
          Cards you get correct appear less frequently (longer interval). Cards you miss appear sooner.
          This SM-2 algorithm ensures you review at the optimal time to maximize retention.
        </div>

        {/* Queue list */}
        {queueItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-semibold mb-1">Queue is empty</p>
            <p className="text-slate-400 text-sm mb-4">
              Answer more questions during study sessions to build your review queue.
            </p>
            <Button
              onClick={() => router.push('/study')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              Start Studying
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
              Due Now ({dueCount})
            </h2>
            <div className="divide-y divide-slate-100">
              {queueItems.map((item, i) => (
                <ReviewQueueRow key={item.id ?? i} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Active review
  if (mode === 'active') {
    const currentItem = queueItems[currentItemIndex];

    return (
      <div className="flex flex-col h-screen bg-slate-50">
        {/* Top bar */}
        <div className="shrink-0 flex items-center gap-4 px-6 py-3 bg-white border-b border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 flex-1">
            <Repeat className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-bold text-slate-800">Review Session</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              {currentItemIndex + 1} / {sessionTotal_count}
            </span>
            <div className="w-24">
              <Progress value={progressPct} className="h-1.5" />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode('done')}
            className="border-slate-200 text-slate-600 text-xs"
          >
            End Review
          </Button>
        </div>

        {/* Question content */}
        <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
          {loadingQuestion ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            </div>
          ) : currentQuestion ? (
            <div className="space-y-4">
              {/* Question header */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                  Review Card
                </Badge>
                {currentQuestion.sub_skill_id && SUB_SKILL_MAP[currentQuestion.sub_skill_id] && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                    {SUB_SKILL_MAP[currentQuestion.sub_skill_id].name}
                  </Badge>
                )}
              </div>

              {/* Passage if present */}
              {currentPassage && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Passage</p>
                  <p className="text-sm leading-relaxed text-slate-700">
                    {currentPassage.passage_text}
                  </p>
                </div>
              )}

              {/* Question */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                <p className="text-base font-medium text-slate-800 leading-relaxed">
                  {currentQuestion.question_text}
                </p>

                {/* Answer choices */}
                <div className="space-y-2.5">
                  {Object.entries(currentQuestion.answer_choices)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([letter, text]) => {
                      const isSelected = selectedAnswer === letter;
                      const isCorrectAnswer = letter === currentQuestion.correct_answer;
                      return (
                        <button
                          key={letter}
                          onClick={() => handleAnswer(letter)}
                          disabled={isAnswered}
                          className={`
                            w-full text-left px-4 py-3 rounded-lg border-2 transition-all duration-100
                            font-medium text-sm flex items-start gap-3
                            ${
                              !isAnswered
                                ? isSelected
                                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                                  : 'border-slate-200 bg-white hover:border-blue-300 text-slate-800 cursor-pointer'
                                : isCorrectAnswer
                                ? 'border-green-500 bg-green-50 text-green-900 cursor-default'
                                : isSelected
                                ? 'border-red-500 bg-red-50 text-red-900 cursor-default'
                                : 'border-slate-100 bg-slate-50 text-slate-400 cursor-default opacity-60'
                            }
                          `}
                        >
                          <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                            !isAnswered
                              ? isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 text-slate-500'
                              : isCorrectAnswer ? 'border-green-500 bg-green-500 text-white'
                              : isSelected ? 'border-red-500 bg-red-500 text-white'
                              : 'border-slate-200 text-slate-400'
                          }`}>
                            {letter}
                          </span>
                          <span className="flex-1 pt-0.5">{text}</span>
                          {isAnswered && isCorrectAnswer && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
                          {isAnswered && isSelected && !isCorrectAnswer && <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                </div>

                {/* Result + next */}
                {isAnswered && (
                  <div className="flex items-center justify-between pt-2">
                    <div className={`flex items-center gap-2 text-sm font-semibold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                      {isCorrect ? (
                        <><CheckCircle2 className="h-4 w-4" /> Correct!</>
                      ) : (
                        <><XCircle className="h-4 w-4" /> Incorrect — {currentQuestion.correct_answer} is right</>
                      )}
                    </div>
                    <Button
                      onClick={handleNext}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                      {currentItemIndex < sessionTotal_count - 1 ? (
                        <>Next Card <ChevronRight className="h-4 w-4 ml-1" /></>
                      ) : (
                        <>Finish Review <ChevronRight className="h-4 w-4 ml-1" /></>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm mb-2">Question not found</p>
              <p className="text-slate-400 text-xs font-mono">{currentItem?.question_id}</p>
              <Button onClick={handleNext} variant="outline" className="mt-4">
                Skip
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Done view
  const accuracy = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-8 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <Trophy className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900">Review Complete!</h2>
          <p className="text-slate-500 text-sm mt-1">
            Great work maintaining your knowledge retention.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-2xl font-black text-slate-900">{sessionTotal}</p>
            <p className="text-xs text-slate-500">Reviewed</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-2xl font-black text-green-700">{sessionCorrect}</p>
            <p className="text-xs text-slate-500">Correct</p>
          </div>
          <div className={`rounded-xl p-3 ${accuracy >= 80 ? 'bg-green-50' : accuracy >= 60 ? 'bg-yellow-50' : 'bg-red-50'}`}>
            <p className={`text-2xl font-black ${accuracy >= 80 ? 'text-green-700' : accuracy >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
              {accuracy}%
            </p>
            <p className="text-xs text-slate-500">Accuracy</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push('/')} className="flex-1 border-slate-200">
            Dashboard
          </Button>
          <Button onClick={() => router.push('/review')} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
            Keep Studying
          </Button>
        </div>
      </div>
    </div>
  );
}
