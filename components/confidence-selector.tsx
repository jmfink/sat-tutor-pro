'use client';

import type { ConfidenceLevel } from '@/types';

interface ConfidenceSelectorProps {
  value: ConfidenceLevel | null;
  onChange: (value: ConfidenceLevel) => void;
}

const OPTIONS: { value: ConfidenceLevel; label: string; activeClass: string }[] = [
  {
    value: 'guessing',
    label: 'Guessing',
    activeClass: 'bg-red-100 border-red-400 text-red-700 font-semibold',
  },
  {
    value: 'okay',
    label: 'Okay',
    activeClass: 'bg-yellow-100 border-yellow-400 text-yellow-700 font-semibold',
  },
  {
    value: 'confident',
    label: 'Confident',
    activeClass: 'bg-green-100 border-green-400 text-green-700 font-semibold',
  },
];

export function ConfidenceSelector({ value, onChange }: ConfidenceSelectorProps) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Confidence level">
      {OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`
              px-3 py-1.5 rounded-md border-2 text-xs transition-all duration-100 select-none
              ${isActive
                ? opt.activeClass
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }
            `}
            aria-pressed={isActive}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
