import type { MoodSignal } from '@/types';

export interface SessionMetrics {
  consecutiveWrong: number;
  timePerQuestion: number[]; // seconds per question, in order
  recentMessages: string[]; // last few free-text inputs from student
  skipRequests: number;
}

const TERSE_PATTERNS = [
  /^i ?don'?t ?know$/i,
  /^idk$/i,
  /^whatever$/i,
  /^just tell me$/i,
  /^skip$/i,
  /^next$/i,
  /^no idea$/i,
  /^i give up$/i,
  /^help$/i,
  /^\?+$/,
];

function isTerseResponse(message: string): boolean {
  const trimmed = message.trim();
  return TERSE_PATTERNS.some(p => p.test(trimmed)) || trimmed.length < 10;
}

function isRushing(times: number[]): boolean {
  if (times.length < 3) return false;
  const recent = times.slice(-3);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  // Rushing = average < 20 seconds per question
  return avg < 20;
}

function isShuttingDown(times: number[]): boolean {
  if (times.length < 3) return false;
  const recent = times.slice(-3);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  // Shutting down = average > 3 minutes per question
  return avg > 180;
}

export interface FrustrationResult {
  isFrustrated: boolean;
  signals: MoodSignal[];
  severity: 'none' | 'mild' | 'moderate' | 'high';
}

export function detectFrustration(metrics: SessionMetrics): FrustrationResult {
  const signals: MoodSignal[] = [];

  if (metrics.consecutiveWrong >= 3) {
    signals.push('consecutive_wrong');
  }

  if (isRushing(metrics.timePerQuestion)) {
    signals.push('rushing');
  }

  if (isShuttingDown(metrics.timePerQuestion)) {
    signals.push('shutting_down');
  }

  if (metrics.recentMessages.some(isTerseResponse)) {
    signals.push('terse_response');
  }

  if (metrics.skipRequests >= 2) {
    signals.push('skip_request');
  }

  const isFrustrated = signals.length >= 1;

  let severity: FrustrationResult['severity'] = 'none';
  if (signals.length >= 3) severity = 'high';
  else if (signals.length === 2) severity = 'moderate';
  else if (signals.length === 1) severity = 'mild';

  return { isFrustrated, signals, severity };
}

export function buildFrustrationPromptInjection(result: FrustrationResult): string {
  if (!result.isFrustrated) return '';

  const signalDesc = result.signals.map(s => {
    switch (s) {
      case 'consecutive_wrong': return '3+ consecutive wrong answers';
      case 'rushing': return 'decreasing time per question (rushing)';
      case 'shutting_down': return 'increasing time per question (shutting down)';
      case 'terse_response': return 'short/terse responses';
      case 'skip_request': return 'repeated skip requests';
    }
  }).join(', ');

  return `\n\nIMPORTANT: The student appears frustrated (signals: ${signalDesc}).
Do the following:
1. Acknowledge without being patronizing — don't say "I can see you're frustrated"
2. Normalize the difficulty — "This is one of the hardest question types on the SAT"
3. Offer a choice: easier topic, different explanation, or short break
4. Keep tone casual and peer-like, not teacher-like.`;
}
