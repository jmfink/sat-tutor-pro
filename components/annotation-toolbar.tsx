'use client';

import { useState, useEffect } from 'react';
import { Highlighter, Strikethrough, Trash2 } from 'lucide-react';

interface AnnotationToolbarProps {
  onHighlight?: (text: string) => void;
  onCrossOut?: (text: string) => void;
  onClear?: () => void;
}

type ActiveTool = 'highlight' | 'crossout' | null;

// Inject annotation CSS once per document lifetime
function ensureStyles() {
  const id = 'annotation-toolbar-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    .annotation-highlight {
      background-color: #fef08a;
      border-radius: 2px;
      padding: 0 1px;
    }
    .annotation-highlight:hover { background-color: #fde047; }
    .annotation-crossout {
      text-decoration: line-through;
      text-decoration-color: #ef4444;
      text-decoration-thickness: 2px;
      color: #9ca3af;
    }
    .annotation-crossout:hover { background-color: #fee2e2; border-radius: 2px; }
  `;
  document.head.appendChild(style);
}

function applyAnnotation(tool: 'highlight' | 'crossout'): string | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const selectedText = selection.toString().trim();
  if (!selectedText) return null;

  ensureStyles();

  const span = document.createElement('span');
  span.className = tool === 'highlight' ? 'annotation-highlight' : 'annotation-crossout';
  span.dataset.annotation = tool;

  try {
    range.surroundContents(span);
  } catch {
    try {
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    } catch {
      selection.removeAllRanges();
      return null;
    }
  }
  selection.removeAllRanges();
  return selectedText;
}

function clearAnnotations() {
  document.querySelectorAll('.annotation-highlight, .annotation-crossout').forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
}

export function AnnotationToolbar({ onHighlight, onCrossOut, onClear }: AnnotationToolbarProps) {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);

  // Correct SAT UX: click tool to activate mode, then select text anywhere to apply.
  // We listen at the document level so the user can select text in the passage without
  // needing to interact with the toolbar again after activating a tool.
  useEffect(() => {
    if (!activeTool) return;

    const handleMouseUp = () => {
      const text = applyAnnotation(activeTool);
      if (!text) return;
      if (activeTool === 'highlight') onHighlight?.(text);
      else onCrossOut?.(text);
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [activeTool, onHighlight, onCrossOut]);

  const toggle = (tool: ActiveTool) => {
    setActiveTool(prev => (prev === tool ? null : tool));
  };

  const handleClear = () => {
    clearAnnotations();
    setActiveTool(null);
    onClear?.();
  };

  const isHighlight = activeTool === 'highlight';
  const isCrossOut = activeTool === 'crossout';

  return (
    <div
      className="inline-flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg shadow-sm"
      role="toolbar"
      aria-label="Annotation tools"
    >
      {/* Highlight */}
      <button
        type="button"
        onClick={() => toggle('highlight')}
        title={isHighlight ? 'Highlight active — select text to apply' : 'Highlight text'}
        aria-pressed={isHighlight}
        className={`
          inline-flex items-center gap-1 px-2 py-1.5 rounded-l-lg border-r text-xs font-medium
          transition-colors select-none
          ${isHighlight
            ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
            : 'text-slate-500 hover:bg-yellow-50 hover:text-yellow-700 border-slate-200'}
        `}
      >
        <Highlighter className="h-3.5 w-3.5" />
        {isHighlight && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />}
      </button>

      {/* Cross Out */}
      <button
        type="button"
        onClick={() => toggle('crossout')}
        title={isCrossOut ? 'Cross out active — select text to apply' : 'Cross out text'}
        aria-pressed={isCrossOut}
        className={`
          inline-flex items-center gap-1 px-2 py-1.5 border-r text-xs font-medium
          transition-colors select-none
          ${isCrossOut
            ? 'bg-red-50 border-red-300 text-red-700'
            : 'text-slate-500 hover:bg-red-50 hover:text-red-600 border-slate-200'}
        `}
      >
        <Strikethrough className="h-3.5 w-3.5" />
        {isCrossOut && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
      </button>

      {/* Clear All */}
      <button
        type="button"
        onClick={handleClear}
        title="Clear all annotations"
        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-r-lg text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors select-none"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
