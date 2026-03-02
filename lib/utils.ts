import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Parse a SAT grid-in answer string to a number, or null if invalid. */
export function parseGridInAnswer(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const fraction = s.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (fraction) {
    const den = parseInt(fraction[2], 10);
    if (den === 0) return null;
    return parseInt(fraction[1], 10) / den;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Returns true if two grid-in answer strings are numerically equivalent. */
export function gridInAnswersMatch(student: string, correct: string): boolean {
  const a = parseGridInAnswer(student);
  const b = parseGridInAnswer(correct);
  if (a === null || b === null) return false;
  return Math.abs(a - b) < 1e-9;
}
