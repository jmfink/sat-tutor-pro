'use client';

import { useState, useCallback } from 'react';
import { Separator } from '@/components/ui/separator';
import { Highlighter, Strikethrough, Trash2 } from 'lucide-react';

interface AnnotationToolbarProps {
  onHighlight: (text: string, range: Range) => void;
  onCrossOut: (text: string, range: Range) => void;
  onClear: () => void;
}

type ActiveTool = 'select' | 'highlight' | 'crossout' | null;

// Inject annotation styles into the document once
function ensureStyles() {
  const styleId = 'annotation-toolbar-styles';
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .annotation-highlight {
      background-color: #fef08a;
      border-radius: 2px;
      padding: 0 1px;
      cursor: pointer;
    }
    .annotation-crossout {
      text-decoration: line-through;
      text-decoration-color: #ef4444;
      text-decoration-thickness: 2px;
      color: #9ca3af;
      cursor: pointer;
    }
    .annotation-highlight:hover {
      background-color: #fde047;
    }
    .annotation-crossout:hover {
      background-color: #fee2e2;
      border-radius: 2px;
    }
  `;
  document.head.appendChild(style);
}

function applyAnnotation(tool: 'highlight' | 'crossout') {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const selectedText = selection.toString().trim();
  if (!selectedText) return null;

  ensureStyles();

  const span = document.createElement('span');
  span.className =
    tool === 'highlight' ? 'annotation-highlight' : 'annotation-crossout';
  span.dataset.annotation = tool;
  span.dataset.originalText = selectedText;

  try {
    range.surroundContents(span);
    selection.removeAllRanges();
    return { text: selectedText, range };
  } catch {
    // surroundContents fails if selection crosses element boundaries
    // Fall back to extractContents + insert
    try {
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
      selection.removeAllRanges();
      return { text: selectedText, range };
    } catch {
      selection.removeAllRanges();
      return null;
    }
  }
}

function clearAnnotations() {
  const annotations = document.querySelectorAll(
    '.annotation-highlight, .annotation-crossout'
  );
  annotations.forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el);
    }
    parent.removeChild(el);
  });
}

export function AnnotationToolbar({ onHighlight, onCrossOut, onClear }: AnnotationToolbarProps) {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);

  const handleMouseUp = useCallback(() => {
    if (!activeTool || activeTool === 'select') return;

    const result = applyAnnotation(activeTool as 'highlight' | 'crossout');
    if (!result) return;

    if (activeTool === 'highlight') {
      onHighlight(result.text, result.range);
    } else {
      onCrossOut(result.text, result.range);
    }
  }, [activeTool, onHighlight, onCrossOut]);

  const activateHighlight = () => {
    setActiveTool((t) => (t === 'highlight' ? 'select' : 'highlight'));
  };

  const activateCrossOut = () => {
    setActiveTool((t) => (t === 'crossout' ? 'select' : 'crossout'));
  };

  const handleClearAll = () => {
    clearAnnotations();
    setActiveTool(null);
    onClear();
  };

  // Bind mouseup to document when a tool is active
  // We use a simple inline effect-like pattern via button interaction
  const isHighlightActive = activeTool === 'highlight';
  const isCrossOutActive = activeTool === 'crossout';

  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-1.5 bg-white border border-slate-200 rounded-xl shadow-md"
      role="toolbar"
      aria-label="Annotation tools"
      // Listen for mouseup on the toolbar's context (passage area)
      // We attach to document in an effect-like way via onMouseUp bubbling
      onMouseUp={handleMouseUp}
    >
      <span className="text-xs font-semibold text-slate-400 pl-1 pr-2 select-none">
        Annotate:
      </span>

      {/* Highlight tool */}
      <button
        type="button"
        onClick={activateHighlight}
        title="Highlight text (select text in passage while active)"
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium
          transition-all duration-100 select-none
          ${isHighlightActive
            ? 'bg-yellow-100 border-yellow-400 text-yellow-800 shadow-inner'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700'}
        `}
        aria-pressed={isHighlightActive}
      >
        <Highlighter className="h-3.5 w-3.5" />
        Highlight
        {isHighlightActive && (
          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse ml-0.5" />
        )}
      </button>

      {/* Cross out tool */}
      <button
        type="button"
        onClick={activateCrossOut}
        title="Cross out text (select text in passage while active)"
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium
          transition-all duration-100 select-none
          ${isCrossOutActive
            ? 'bg-red-50 border-red-400 text-red-700 shadow-inner'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600'}
        `}
        aria-pressed={isCrossOutActive}
      >
        <Strikethrough className="h-3.5 w-3.5" />
        Cross Out
        {isCrossOutActive && (
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse ml-0.5" />
        )}
      </button>

      <Separator orientation="vertical" className="h-5 mx-0.5" />

      {/* Clear all */}
      <button
        type="button"
        onClick={handleClearAll}
        title="Clear all annotations"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 text-xs font-medium transition-colors select-none"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Clear All
      </button>

    </div>
  );
}
