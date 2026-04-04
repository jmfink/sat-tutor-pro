'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Question, StudentContextProfile, ConversationMessage, TutorMode } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  RefreshCw,
  Send,
  BookOpen,
  Key,
  HelpCircle,
  XCircle,
  Lightbulb,
  ToggleLeft,
  ToggleRight,
  Loader2,
  ThumbsDown,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { renderMathText } from '@/lib/math-text';
import { toast } from 'sonner';

interface ExplanationPanelProps {
  question: Question;
  studentAnswer: string;
  isCorrect: boolean;
  tutorMode: TutorMode;
  onModeToggle: (mode: TutorMode) => void;
  studentProfile: StudentContextProfile;
  sessionHistory: ConversationMessage[];
}

const EXPLANATION_STRATEGIES = [
  'step_by_step',
  'analogy',
  'elimination',
  'visual_description',
  'algebraic',
] as const;

type ExplanationStrategy = (typeof EXPLANATION_STRATEGIES)[number];

const STRATEGY_LABELS: Record<ExplanationStrategy, string> = {
  step_by_step: 'Step by step',
  analogy: 'With an analogy',
  elimination: 'By elimination',
  visual_description: 'Visual approach',
  algebraic: 'Algebraic method',
};

interface HelpButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
  rwOnly?: boolean;
}

const HELP_BUTTONS: HelpButton[] = [
  {
    id: 'strategy',
    label: 'Strategy',
    icon: <Lightbulb className="h-3.5 w-3.5" />,
    prompt: 'What is the best strategy to approach this type of question?',
  },
  {
    id: 'break_down_passage',
    label: 'Break down passage',
    icon: <BookOpen className="h-3.5 w-3.5" />,
    prompt: 'Can you break down the passage into simpler parts to help me understand it?',
    rwOnly: true,
  },
  {
    id: 'keywords',
    label: 'Keywords to look for',
    icon: <Key className="h-3.5 w-3.5" />,
    prompt: 'What are the key words or phrases I should focus on in this passage?',
    rwOnly: true,
  },
  {
    id: 'stuck',
    label: "I'm stuck",
    icon: <HelpCircle className="h-3.5 w-3.5" />,
    prompt: "I'm stuck. Can you give me a hint without giving away the answer?",
  },
  {
    id: 'eliminate',
    label: 'Help me eliminate',
    icon: <XCircle className="h-3.5 w-3.5" />,
    prompt: 'Can you help me eliminate the wrong answer choices?',
  },
];

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`
          max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
          ${isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-slate-100 text-slate-800 rounded-bl-md'}
        `}
      >
        {renderMathText(message.content)}
      </div>
    </div>
  );
}

export function ExplanationPanel({
  question,
  studentAnswer,
  isCorrect,
  tutorMode,
  onModeToggle,
  studentProfile,
  sessionHistory,
}: ExplanationPanelProps) {
  const { userId } = useAuth();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputText, setInputText] = useState('');
  const [strategyIndex, setStrategyIndex] = useState(0);
  const [initKey, setInitKey] = useState(0);
  const [explanationFeedbackSent, setExplanationFeedbackSent] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleExplanationFeedback = async () => {
    if (explanationFeedbackSent) return;
    setExplanationFeedbackSent(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: question.question_id,
          student_id: userId ?? '',
          feedback_type: 'bad_explanation',
        }),
      });
      toast.success("Thanks — we'll improve this explanation");
    } catch {
      setExplanationFeedbackSent(false);
      toast.error('Could not submit feedback');
    }
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  // Abort any in-flight stream on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  const sendToAPI = useCallback(
    async (userMessage: string, conversationHistory: ConversationMessage[]) => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setIsStreaming(true);
      setStreamingText('');

      const payload = {
        question,
        studentAnswer,
        isCorrect,
        tutorMode,
        studentProfile,
        conversationHistory,
        userMessage,
        strategy: EXPLANATION_STRATEGIES[strategyIndex],
      };

      try {
        const res = await fetch('/api/claude/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`API error: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          // Parse SSE lines
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') break;
              try {
                const parsed = JSON.parse(data);
                const text = parsed.delta?.text ?? parsed.text ?? '';
                if (text) {
                  fullText += text;
                  setStreamingText(fullText);
                }
              } catch {
                // Plain text chunk (non-SSE)
                fullText += data;
                setStreamingText(fullText);
              }
            }
          }
        }

        const assistantMessage: ConversationMessage = {
          role: 'assistant',
          content: fullText,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setStreamingText('');
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: 'Sorry, I had trouble generating a response. Please try again.',
            },
          ]);
          setStreamingText('');
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [question, studentAnswer, isCorrect, tutorMode, studentProfile, strategyIndex]
  );

  // Auto-initialize explanation; re-runs when initKey changes (mode toggle triggers a re-init)
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initPrompt =
      tutorMode === 'socratic'
        ? "Let's work through this together. Can you tell me what you were thinking when you picked your answer?"
        : undefined;

    sendToAPI(initPrompt ?? '__init__', sessionHistory);
  }, [initKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    const userMessage: ConversationMessage = { role: 'user', content: text };
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInputText('');

    await sendToAPI(text, updatedHistory);
  }, [inputText, isStreaming, messages, sendToAPI]);

  const handleHelpButton = useCallback(
    async (prompt: string) => {
      if (isStreaming) return;
      const userMessage: ConversationMessage = { role: 'user', content: prompt };
      const updatedHistory = [...messages, userMessage];
      setMessages(updatedHistory);
      await sendToAPI(prompt, updatedHistory);
    },
    [isStreaming, messages, sendToAPI]
  );

  const handleTryDifferent = useCallback(() => {
    const nextIndex = (strategyIndex + 1) % EXPLANATION_STRATEGIES.length;
    setStrategyIndex(nextIndex);

    const strategy = EXPLANATION_STRATEGIES[nextIndex];
    const prompt = `Can you explain this ${STRATEGY_LABELS[strategy].toLowerCase()}?`;
    const userMessage: ConversationMessage = { role: 'user', content: prompt };
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    sendToAPI(prompt, updatedHistory);
  }, [strategyIndex, messages, sendToAPI]);

  const handleModeToggle = useCallback(() => {
    const newMode: TutorMode = tutorMode === 'socratic' ? 'direct' : 'socratic';
    onModeToggle(newMode);
    // Reset conversation and trigger re-init effect
    setMessages([]);
    setStreamingText('');
    hasInitialized.current = false;
    setInitKey((k) => k + 1);
  }, [tutorMode, onModeToggle]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isRW = question.section === 'reading_writing';
  const visibleHelpButtons = HELP_BUTTONS.filter((b) => !b.rwOnly || isRW);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">
            {isCorrect ? 'Great job!' : "Let's figure this out"}
          </span>
          {isStreaming && (
            <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTryDifferent}
            disabled={isStreaming}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors disabled:opacity-40"
          >
            <RefreshCw className="h-3 w-3" />
            Different explanation
          </button>

          <button
            onClick={handleExplanationFeedback}
            disabled={explanationFeedbackSent}
            title={explanationFeedbackSent ? 'Feedback submitted' : 'Flag this explanation as unhelpful'}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
              explanationFeedbackSent
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
            }`}
          >
            <ThumbsDown className="h-3 w-3" />
            {explanationFeedbackSent ? 'Reported' : ''}
          </button>

          <Separator orientation="vertical" className="h-5" />

          {/* Mode toggle */}
          <button
            onClick={handleModeToggle}
            className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-slate-100 transition-colors"
            title={tutorMode === 'socratic' ? 'Switch to Direct mode' : 'Switch to Guide Me mode'}
          >
            {tutorMode === 'socratic' ? (
              <>
                <ToggleLeft className="h-4 w-4 text-blue-500" />
                <span className="text-blue-600 font-medium">Guide Me</span>
              </>
            ) : (
              <>
                <ToggleRight className="h-4 w-4 text-green-500" />
                <span className="text-green-600 font-medium">Just Tell Me</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Strategy badge */}
      <div className="px-4 pt-2 pb-0">
        <Badge variant="outline" className="text-xs text-slate-500 border-slate-200">
          Strategy: {STRATEGY_LABELS[EXPLANATION_STRATEGIES[strategyIndex]]}
        </Badge>
      </div>

      {/* Help buttons */}
      <div className="flex flex-wrap gap-1.5 px-4 pt-2 pb-1">
        {visibleHelpButtons.map((btn) => (
          <button
            key={btn.id}
            onClick={() => handleHelpButton(btn.prompt)}
            disabled={isStreaming}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-40 font-medium"
          >
            {btn.icon}
            {btn.label}
          </button>
        ))}
      </div>

      <Separator className="mx-4 mt-2" />

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0"
      >
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {/* Streaming message */}
        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-slate-100 text-slate-800 text-sm leading-relaxed">
              {renderMathText(streamingText)}
              <span className="inline-block w-1.5 h-3.5 bg-slate-500 ml-0.5 animate-pulse rounded-sm align-middle" />
            </div>
          </div>
        )}

        {/* Loading state */}
        {isStreaming && !streamingText && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-slate-100">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50">
        <div className="flex gap-2 items-end">
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up question..."
            rows={2}
            className="flex-1 resize-none text-sm border-slate-200 focus:border-blue-400 rounded-lg"
            disabled={isStreaming}
          />
          <Button
            onClick={handleSend}
            disabled={!inputText.trim() || isStreaming}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white h-[4.5rem] px-3 rounded-lg disabled:opacity-40"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5 text-right">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
