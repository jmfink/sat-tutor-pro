'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  RotateCcw,
  ListChecks,
  MessageSquare,
} from 'lucide-react';

interface QuestionUploaderProps {
  onComplete: (result: { questionsAdded: number }) => void;
  onDismiss?: () => void;
  studentName?: string;
}

interface UploadedFiles {
  questions: File | null;
  answers: File | null;
  explanations: File | null;
}

interface ParsedQuestion {
  question_number: number;
  question_text: string;
  answer_choices: Record<string, string>;
  correct_answer: string;
  sub_skill_id?: string;
  section?: string;
  difficulty?: number;
  explanation?: string;
  confidence: number; // 0-1, parser confidence
}

interface ParseResult {
  questions: ParsedQuestion[];
  total_parsed: number;
  parse_warnings: string[];
}

type StepStatus = 'idle' | 'loading' | 'success' | 'error';

const STEP_LABELS = ['Upload PDFs', 'Review & Confirm', 'Done'];

function FileDropZone({
  label,
  subtitle,
  icon,
  file,
  onFile,
  accept,
}: {
  label: string;
  subtitle?: string;
  icon: React.ReactNode;
  file: File | null;
  onFile: (f: File) => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`
        relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed
        cursor-pointer transition-colors duration-150 min-h-[100px]
        ${file
          ? 'border-green-300 bg-green-50'
          : isDragging
          ? 'border-blue-400 bg-blue-50'
          : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50'}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept ?? '.pdf'}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {file ? (
        <>
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <div className="text-center">
            <p className="text-xs font-semibold text-green-700">{file.name}</p>
            <p className="text-xs text-green-500">
              {(file.size / 1024).toFixed(0)} KB
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="text-slate-400">{icon}</div>
          <p className="text-xs font-semibold text-slate-600 text-center">{label}</p>
          {subtitle && (
            <p className="text-[11px] text-slate-400 text-center leading-tight">{subtitle}</p>
          )}
          <p className="text-[11px] text-slate-400">Click or drag PDF here</p>
        </>
      )}
    </div>
  );
}

function ParsedQuestionRow({ q }: { q: ParsedQuestion }) {
  const confidenceColor =
    q.confidence >= 0.8
      ? 'text-green-600'
      : q.confidence >= 0.5
      ? 'text-yellow-600'
      : 'text-red-500';

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
        {q.question_number}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 line-clamp-2">{q.question_text}</p>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <span className="text-xs text-slate-400">
            Answer: <span className="font-semibold text-slate-600">{q.correct_answer}</span>
          </span>
          {q.sub_skill_id && (
            <Badge variant="outline" className="text-[11px] py-0 px-1.5">
              {q.sub_skill_id}
            </Badge>
          )}
          {q.section && (
            <Badge
              variant="outline"
              className={`text-[11px] py-0 px-1.5 ${
                q.section === 'math'
                  ? 'border-purple-200 text-purple-600'
                  : 'border-blue-200 text-blue-600'
              }`}
            >
              {q.section === 'math' ? 'Math' : 'R&W'}
            </Badge>
          )}
          <span className={`text-[11px] font-medium ${confidenceColor}`}>
            {Math.round(q.confidence * 100)}% confidence
          </span>
        </div>
      </div>
    </div>
  );
}

export function QuestionUploader({ onComplete, onDismiss, studentName }: QuestionUploaderProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [files, setFiles] = useState<UploadedFiles>({
    questions: null,
    answers: null,
    explanations: null,
  });
  const [parseStatus, setParseStatus] = useState<StepStatus>('idle');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseProgress, setParseProgress] = useState(0);
  const [confirmStatus, setConfirmStatus] = useState<StepStatus>('idle');
  const [confirmPhase, setConfirmPhase] = useState<'classifying' | 'saving'>('classifying');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmWarnings, setConfirmWarnings] = useState<string[]>([]);
  const [questionsAdded, setQuestionsAdded] = useState(0);
  const [duplicatesSkipped, setDuplicatesSkipped] = useState(0);

  const allFilesUploaded = files.questions && files.answers && files.explanations;

  const handleExtractAndParse = useCallback(async () => {
    if (!files.questions || !files.answers || !files.explanations) return;

    setParseStatus('loading');
    setParseProgress(10);
    setParseError(null);

    try {
      setParseProgress(30);

      const formData = new FormData();
      formData.append('questions', files.questions);
      formData.append('answers', files.answers);
      formData.append('explanations', files.explanations);

      // No Content-Type header — browser sets it with multipart boundary automatically
      const res = await fetch('/api/parent/upload-questions/parse', {
        method: 'POST',
        body: formData,
      });

      setParseProgress(85);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `Parse failed (${res.status})`);
      }

      const data: ParseResult = await res.json();
      setParseResult(data);
      setParseProgress(100);
      setParseStatus('success');
      setStep(1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error during parsing';
      setParseError(message);
      setParseStatus('error');
      setParseProgress(0);
    }
  }, [files]);

  const handleConfirm = useCallback(async () => {
    if (!parseResult) return;

    setConfirmStatus('loading');
    setConfirmPhase('classifying');
    setConfirmError(null);
    setConfirmWarnings([]);

    try {
      // Step 1: classify to populate sub_skill_id + difficulty (required by DB)
      const classifyRes = await fetch('/api/parent/upload-questions/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: parseResult.questions }),
      });
      if (!classifyRes.ok) {
        const e = await classifyRes.json().catch(() => ({}));
        throw new Error(e.error ?? `Classification failed (${classifyRes.status})`);
      }
      const classifyData = await classifyRes.json();
      const classifiedQuestions = classifyData.classified ?? parseResult.questions;

      // Step 2: persist to database
      setConfirmPhase('saving');
      const res = await fetch('/api/parent/upload-questions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: classifiedQuestions }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }

      // Surface partial failures as warnings rather than silently ignoring them
      if (data.errors > 0) {
        const details: string[] = data.error_details ?? [];
        if (data.questions_added === 0) {
          throw new Error(
            `All ${data.errors} questions failed to save. ` +
            `First error: ${details[0] ?? 'unknown'}`
          );
        }
        setConfirmWarnings([
          `${data.errors} question${data.errors !== 1 ? 's' : ''} failed to save:`,
          ...details.slice(0, 5),
        ]);
      }

      setQuestionsAdded(data.questions_added);
      setDuplicatesSkipped(data.duplicates_skipped ?? 0);
      setConfirmStatus('success');
      setStep(2);
      onComplete({ questionsAdded: data.questions_added });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setConfirmError(message);
      setConfirmStatus('error');
    }
  }, [parseResult, onComplete]);

  const handleReset = () => {
    setStep(0);
    setFiles({ questions: null, answers: null, explanations: null });
    setParseStatus('idle');
    setParseResult(null);
    setParseError(null);
    setParseProgress(0);
    setConfirmStatus('idle');
    setConfirmError(null);
    setQuestionsAdded(0);
    setDuplicatesSkipped(0);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Step indicator */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-3">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`
                  flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-colors
                  ${step === i
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : step > i
                    ? 'bg-green-100 border-green-400 text-green-700'
                    : 'bg-white border-slate-200 text-slate-400'}
                `}
              >
                {step > i ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={`text-sm font-medium ${
                  step === i ? 'text-blue-700' : step > i ? 'text-green-700' : 'text-slate-400'
                }`}
              >
                {label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <ChevronRight className="h-4 w-4 text-slate-300 mx-1" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* STEP 0: Upload */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                Upload SAT Question PDFs
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Upload three PDFs: questions, answer key, and explanations. We&apos;ll
                extract and classify the questions automatically.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FileDropZone
                label="Questions PDF"
                subtitle="The main practice test — largest file (~10MB)"
                icon={<FileText className="h-6 w-6" />}
                file={files.questions}
                onFile={(f) => setFiles((prev) => ({ ...prev, questions: f }))}
              />
              <FileDropZone
                label="Answer Key PDF"
                subtitle="The scoring guide — filename contains 'scoring'"
                icon={<ListChecks className="h-6 w-6" />}
                file={files.answers}
                onFile={(f) => setFiles((prev) => ({ ...prev, answers: f }))}
              />
              <FileDropZone
                label="Explanations PDF"
                subtitle="Answer explanations — filename contains 'answers'"
                icon={<MessageSquare className="h-6 w-6" />}
                file={files.explanations}
                onFile={(f) => setFiles((prev) => ({ ...prev, explanations: f }))}
              />
            </div>

            {parseStatus === 'loading' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    Extracting and parsing questions...
                  </span>
                  <span className="font-medium">{parseProgress}%</span>
                </div>
                <Progress value={parseProgress} className="h-2" />
              </div>
            )}

            {parseStatus === 'error' && parseError && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Parse failed</p>
                  <p className="text-xs text-red-600 mt-0.5">{parseError}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                onClick={handleExtractAndParse}
                disabled={!allFilesUploaded || parseStatus === 'loading'}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-40"
              >
                {parseStatus === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Extract Questions
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
              {!allFilesUploaded && (
                <p className="text-xs text-slate-400">Upload all 3 PDFs to continue</p>
              )}
            </div>
          </div>
        )}

        {/* STEP 1: Review */}
        {step === 1 && parseResult && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-800">
                  Review Parsed Questions
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {parseResult.total_parsed} question
                  {parseResult.total_parsed !== 1 ? 's' : ''} parsed. Review the
                  classification below and confirm to add them.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  {parseResult.total_parsed} questions
                </Badge>
              </div>
            </div>

            {parseResult.parse_warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-sm">
                  <AlertCircle className="h-4 w-4" />
                  Parse Warnings
                </div>
                <ul className="list-disc list-inside space-y-0.5">
                  {parseResult.parse_warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-600">{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <ScrollArea className="max-h-72">
                <div className="px-4 divide-y divide-slate-100">
                  {parseResult.questions.map((q, i) => (
                    <ParsedQuestionRow key={i} q={q} />
                  ))}
                </div>
              </ScrollArea>
            </div>

            {confirmStatus === 'error' && confirmError && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Upload failed</p>
                  <p className="text-xs text-red-600 mt-0.5 whitespace-pre-wrap">{confirmError}</p>
                </div>
              </div>
            )}

            {confirmWarnings.length > 0 && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-700">Partial save</p>
                  <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                    {confirmWarnings.map((w, i) => (
                      <li key={i} className="text-xs text-amber-600">{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                onClick={handleConfirm}
                disabled={confirmStatus === 'loading'}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-40"
              >
                {confirmStatus === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {confirmPhase === 'classifying' ? 'Classifying…' : 'Saving…'}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirm & Add Questions
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={confirmStatus === 'loading'}
                className="border-slate-200 text-slate-600"
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Start over
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Done */}
        {step === 2 && (
          <div className="flex flex-col items-center justify-center gap-5 py-10 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-slate-800">
                {questionsAdded} question{questionsAdded !== 1 ? 's' : ''} added
                {duplicatesSkipped > 0 ? `, ${duplicatesSkipped} duplicate${duplicatesSkipped !== 1 ? 's' : ''} skipped` : '!'}
              </h3>
              <p className="text-sm text-slate-500">
                {questionsAdded > 0 ? (
                  <>
                    Successfully added to{' '}
                    <span className="font-semibold text-slate-700">
                      {studentName ? `${studentName}'s` : 'the'} question bank
                    </span>{' '}
                    and ready for practice.
                  </>
                ) : (
                  <>All questions already exist in the question bank.</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <Button
                onClick={onDismiss ?? handleReset}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Done
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                className="border-slate-200 text-slate-600"
              >
                <Upload className="h-4 w-4 mr-1.5" />
                Upload more
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
