import { Fragment, type ReactNode } from 'react';

/**
 * Renders SAT math expressions with proper HTML superscript tags.
 *
 * Handles (in priority order):
 *   1. Caret + parenthesized exponent:  x^(2t+1), 4^(2x), (1.04)^((6/4)t), 3^(t/2)
 *   2. Caret + simple exponent:         x^2, x^-2, (0.1)^x, 12x^3
 *   3. Implicit variable exponent:      x2, 16x3y2  (letter immediately followed by digits,
 *                                        where the letter is not preceded by another letter)
 *
 * Safe for non-math text — "Question 2", "Step 3", "Chapter 4" are unaffected because
 * the digit is separated from the preceding letter by a space.
 */
export function renderMathText(text: string): ReactNode {
  if (!text) return text;

  // Group 1+2 — caret with parenthesized exponent (one level of nested parens allowed)
  //   e.g.  x^(2t), 4^(2x), 3^(t/2), (1.04)^((6/4)t)
  // Group 3+4 — caret with simple exponent (variable, integer, or negative integer)
  //   e.g.  x^2, x^-2, (0.1)^x, 12x^3
  // Group 5+6 — implicit: letter (not part of a word) immediately followed by digits
  //   e.g.  x2, y3, 16x3y2
  const MATH_RE =
    /([a-zA-Z0-9)])\^\(([^)(]*(?:\([^)(]*\)[^)(]*)*)\)|([a-zA-Z0-9)])\^(-?[a-zA-Z0-9]+)|(?<![a-zA-Z])([a-zA-Z])(\d+)/g;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = MATH_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined) {
      // Pattern 1: base^(expr)
      parts.push(<Fragment key={key++}>{match[1]}<sup>{match[2]}</sup></Fragment>);
    } else if (match[3] !== undefined) {
      // Pattern 2: base^exp
      parts.push(<Fragment key={key++}>{match[3]}<sup>{match[4]}</sup></Fragment>);
    } else {
      // Pattern 3: implicit variable exponent
      parts.push(<Fragment key={key++}>{match[5]}<sup>{match[6]}</sup></Fragment>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) return text;
  if (parts.length === 1 && typeof parts[0] === 'string') return parts[0];
  return <>{parts}</>;
}
