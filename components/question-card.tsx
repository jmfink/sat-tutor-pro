'use client';

import { useState } from 'react';
import type { Question, Passage } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Flag, CheckCircle2, XCircle } from 'lucide-react';
import { ConfidenceSelector } from '@/components/confidence-selector';
import type { ConfidenceLevel } from '@/types';
import { getDifficultyLabel, getDifficultyColor } from '@/lib/constants';
import { gridInAnswersMatch } from '@/lib/utils';

/**
 * Render a string that may contain pipe-delimited table blocks.
 * Two or more consecutive lines containing '|' are parsed as a table;
 * single-line occurrences (e.g. |x − 5| = 10) are left as plain text.
 */
export function renderTextWithTables(text: string): React.ReactNode {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let i = 0;
  let textLines: string[] = [];

  const pushText = () => {
    if (textLines.length === 0) return;
    result.push(
      <span key={result.length} className="whitespace-pre-wrap">
        {textLines.join('\n')}
      </span>
    );
    textLines = [];
  };

  while (i < lines.length) {
    if (lines[i].includes('|')) {
      // Look ahead to count consecutive pipe-containing lines
      let j = i + 1;
      while (j < lines.length && lines[j].includes('|')) j++;
      if (j - i >= 2) {
        // Table block detected
        pushText();
        const tableLines = lines.slice(i, j);
        const rows = tableLines.map(line => line.split('|').map(c => c.trim()));
        // Filter markdown separator rows (cells are only dashes/colons)
        const dataRows = rows.filter(row => {
          const nonEmpty = row.filter(c => c.length > 0);
          return nonEmpty.length > 0 && !nonEmpty.every(c => /^[-:]+$/.test(c));
        });
        if (dataRows.length > 0) {
          const [header, ...body] = dataRows;
          result.push(
            <div key={result.length} className="overflow-x-auto my-3">
              <table className="border-collapse text-sm w-auto">
                <thead>
                  <tr>
                    {header.map((cell, ci) => (
                      <th
                        key={ci}
                        className="border border-slate-300 bg-slate-100 px-3 py-1.5 text-left font-semibold text-slate-700"
                      >
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                {body.length > 0 && (
                  <tbody>
                    {body.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="border border-slate-300 px-3 py-1.5 text-slate-700">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </div>
          );
        }
        i = j;
        continue;
      }
    }
    textLines.push(lines[i]);
    i++;
  }
  pushText();

  return <>{result}</>;
}

interface QuestionCardProps {
  question: Question;
  passage: Passage | null;
  onAnswer: (answer: string, confidence: ConfidenceLevel | null) => void;
  isAnswered: boolean;
  selectedAnswer: string;
  correctAnswer: string;
  timeSpentSeconds: number;
  questionNumber?: number;
  totalQuestions?: number;
}

export function QuestionCard({
  question,
  passage,
  onAnswer,
  isAnswered,
  selectedAnswer,
  correctAnswer,
  timeSpentSeconds,
  questionNumber,
  totalQuestions,
}: QuestionCardProps) {
  const [isFlagged, setIsFlagged] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [gridInValue, setGridInValue] = useState('');

  const handleChoiceClick = (letter: string) => {
    if (isAnswered) return;
    setPendingAnswer(letter);
  };

  const isGridIn = Object.keys(question.answer_choices ?? {}).length === 0;

  const handleSubmit = () => {
    if (isGridIn) {
      if (!gridInValue.trim()) return;
      onAnswer(gridInValue.trim(), confidence);
    } else {
      if (!pendingAnswer) return;
      onAnswer(pendingAnswer, confidence);
    }
  };

  const getChoiceStyle = (letter: string) => {
    const base =
      'relative w-full text-left px-4 py-3 rounded-lg border-2 transition-all duration-150 font-medium text-sm flex items-start gap-3 group';

    if (!isAnswered) {
      if (pendingAnswer === letter) {
        return `${base} border-blue-500 bg-blue-50 text-blue-900`;
      }
      return `${base} border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 text-slate-800 cursor-pointer`;
    }

    // Post-answer states
    if (letter === correctAnswer) {
      return `${base} border-green-500 bg-green-50 text-green-900 cursor-default`;
    }
    if (letter === selectedAnswer && letter !== correctAnswer) {
      return `${base} border-red-500 bg-red-50 text-red-900 cursor-default`;
    }
    return `${base} border-slate-100 bg-slate-50 text-slate-400 cursor-default opacity-60`;
  };

  const getLabelStyle = (letter: string) => {
    const base =
      'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors';

    if (!isAnswered) {
      if (pendingAnswer === letter) {
        return `${base} border-blue-500 bg-blue-500 text-white`;
      }
      return `${base} border-slate-300 text-slate-500 group-hover:border-blue-400 group-hover:text-blue-600`;
    }

    if (letter === correctAnswer) {
      return `${base} border-green-500 bg-green-500 text-white`;
    }
    if (letter === selectedAnswer && letter !== correctAnswer) {
      return `${base} border-red-500 bg-red-500 text-white`;
    }
    return `${base} border-slate-200 text-slate-400`;
  };

  const choices = Object.entries(question.answer_choices).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-3">
          {questionNumber !== undefined && (
            <span className="text-sm font-semibold text-slate-600">
              Question {questionNumber}
              {totalQuestions !== undefined && (
                <span className="text-slate-400 font-normal"> / {totalQuestions}</span>
              )}
            </span>
          )}
          <Badge variant="outline" className={getDifficultyColor(question.difficulty)}>
            {getDifficultyLabel(question.difficulty)}
          </Badge>
          <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-xs">
            {question.section === 'reading_writing' ? 'Reading & Writing' : 'Math'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {isAnswered && (
            <span className="text-xs text-slate-400">
              {timeSpentSeconds}s
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFlagged((f) => !f)}
            className={`h-8 w-8 p-0 rounded-full transition-colors ${
              isFlagged
                ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
            }`}
            title="Flag for review"
          >
            <Flag className="h-4 w-4" fill={isFlagged ? 'currentColor' : 'none'} />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Passage panel */}
        {passage && (
          <>
            <div className="w-1/2 flex flex-col border-r border-slate-100">
              {question.section === 'reading_writing' && (
                <div className="px-5 py-2 bg-slate-50 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Passage
                  </span>
                </div>
              )}
              <ScrollArea className="flex-1 px-5 py-4">
                <div className="text-sm leading-relaxed text-slate-700 passage-text">
                  {renderTextWithTables(passage.passage_text)}
                </div>
              </ScrollArea>
            </div>
            <Separator orientation="vertical" />
          </>
        )}

        {/* Question + choices */}
        <div className={`flex flex-col flex-1 min-h-0 ${passage ? '' : 'w-full'}`}>
          <ScrollArea className="flex-1 px-5 py-4">
            <div className="space-y-5">
              {/* Question text */}
              <div className="text-base leading-relaxed text-slate-800 font-medium">
                {renderTextWithTables(question.question_text)}
              </div>

              {/* Answer choices / grid-in input */}
              {isGridIn ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Your answer
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={isAnswered ? selectedAnswer : gridInValue}
                    onChange={(e) => { if (!isAnswered) setGridInValue(e.target.value); }}
                    readOnly={isAnswered}
                    placeholder="e.g. 289 or 1/2 or 0.5"
                    className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 text-base font-mono
                               focus:outline-none focus:border-blue-500 focus:bg-blue-50/30
                               read-only:bg-slate-50 read-only:text-slate-700 read-only:cursor-default
                               transition-colors"
                  />
                </div>
              ) : (
                <div className="space-y-2.5">
                  {choices.map(([letter, text]) => (
                    <button
                      key={letter}
                      className={getChoiceStyle(letter)}
                      onClick={() => handleChoiceClick(letter)}
                      disabled={isAnswered}
                    >
                      <span className={getLabelStyle(letter)}>{letter}</span>
                      <span className="flex-1 pt-0.5">{text}</span>
                      {isAnswered && letter === correctAnswer && (
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      )}
                      {isAnswered && letter === selectedAnswer && letter !== correctAnswer && (
                        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer: confidence + submit, or result */}
          {!isAnswered ? (
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 font-medium">How confident are you?</span>
                  <ConfidenceSelector value={confidence} onChange={setConfidence} />
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={isGridIn ? !gridInValue.trim() : !pendingAnswer}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  Submit Answer
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-5 py-3 border-t border-slate-100">
              {(() => {
                const isAnswerCorrect = isGridIn
                  ? gridInAnswersMatch(selectedAnswer, correctAnswer)
                  : selectedAnswer === correctAnswer;
                return (
                  <div
                    className={`flex items-center gap-2 text-sm font-semibold ${
                      isAnswerCorrect ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {isAnswerCorrect ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Correct!
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        Incorrect — correct answer is {correctAnswer}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
