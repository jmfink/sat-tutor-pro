'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

interface TimerProps {
  totalSeconds: number;
  onTimeUp: () => void;
  onWarning?: () => void;
  isPaused: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(Math.abs(seconds) / 60);
  const s = Math.abs(seconds) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function Timer({ totalSeconds, onTimeUp, onWarning, isPaused }: TimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const [prevTotal, setPrevTotal] = useState(totalSeconds);
  const warningFiredRef = useRef(false);
  const timeUpFiredRef = useRef(false);
  const onWarningRef = useRef(onWarning);
  const onTimeUpRef = useRef(onTimeUp);

  // Keep refs current so callbacks don't cause re-renders
  useEffect(() => { onWarningRef.current = onWarning; }, [onWarning]);
  useEffect(() => { onTimeUpRef.current = onTimeUp; }, [onTimeUp]);

  // Reset remaining when totalSeconds changes (derived state during render, not effect)
  if (prevTotal !== totalSeconds) {
    setPrevTotal(totalSeconds);
    setRemaining(totalSeconds);
  }

  // Reset ref flags when totalSeconds changes (refs don't cause re-renders)
  useEffect(() => {
    warningFiredRef.current = false;
    timeUpFiredRef.current = false;
  }, [totalSeconds]);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;

        if (!warningFiredRef.current && next <= 300) {
          warningFiredRef.current = true;
          onWarningRef.current?.();
        }

        if (!timeUpFiredRef.current && next <= 0) {
          timeUpFiredRef.current = true;
          clearInterval(interval);
          onTimeUpRef.current();
          return 0;
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused]);

  const isWarning = remaining <= 300 && remaining > 60;
  const isCritical = remaining <= 60;

  return (
    <div
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-mono font-bold text-lg
        transition-colors duration-300 select-none
        ${isCritical
          ? 'border-red-400 bg-red-50 text-red-600 animate-pulse'
          : isWarning
          ? 'border-orange-400 bg-orange-50 text-orange-600'
          : 'border-slate-200 bg-white text-slate-700'}
      `}
      role="timer"
      aria-live="polite"
      aria-label={`Time remaining: ${formatTime(remaining)}`}
    >
      <Clock
        className={`h-4 w-4 ${
          isCritical ? 'text-red-500' : isWarning ? 'text-orange-500' : 'text-slate-400'
        }`}
      />
      <span className="tabular-nums tracking-wider">{formatTime(remaining)}</span>
      {isPaused && (
        <span className="text-xs font-sans font-medium text-slate-400 ml-1">PAUSED</span>
      )}
      {/* Progress bar */}
      <div className="hidden" aria-hidden="true">
        {/* progress embedded as thin bar below the timer if needed by parent */}
      </div>
    </div>
  );
}

export function TimerWithBar({
  totalSeconds,
  onTimeUp,
  onWarning,
  isPaused,
}: TimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const [prevTotal, setPrevTotal] = useState(totalSeconds);
  const warningFiredRef = useRef(false);
  const timeUpFiredRef = useRef(false);
  const onWarningRef = useRef(onWarning);
  const onTimeUpRef = useRef(onTimeUp);

  useEffect(() => { onWarningRef.current = onWarning; }, [onWarning]);
  useEffect(() => { onTimeUpRef.current = onTimeUp; }, [onTimeUp]);

  // Reset remaining when totalSeconds changes (derived state during render, not effect)
  if (prevTotal !== totalSeconds) {
    setPrevTotal(totalSeconds);
    setRemaining(totalSeconds);
  }

  // Reset ref flags when totalSeconds changes (refs don't cause re-renders)
  useEffect(() => {
    warningFiredRef.current = false;
    timeUpFiredRef.current = false;
  }, [totalSeconds]);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (!warningFiredRef.current && next <= 300) {
          warningFiredRef.current = true;
          onWarningRef.current?.();
        }
        if (!timeUpFiredRef.current && next <= 0) {
          timeUpFiredRef.current = true;
          clearInterval(interval);
          onTimeUpRef.current();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const isWarning = remaining <= 300 && remaining > 60;
  const isCritical = remaining <= 60;
  const pct = Math.max(0, remaining / totalSeconds) * 100;

  return (
    <div className="space-y-1.5">
      <Timer
        totalSeconds={remaining}
        onTimeUp={onTimeUp}
        onWarning={onWarning}
        isPaused={true}
      />
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isCritical ? 'bg-red-500' : isWarning ? 'bg-orange-400' : 'bg-blue-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
