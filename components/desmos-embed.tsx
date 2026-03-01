'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Calculator, Maximize2, Minimize2 } from 'lucide-react';

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (
        el: HTMLElement,
        options?: Record<string, unknown>
      ) => DesmosCalculator;
    };
  }
}

interface DesmosCalculator {
  destroy: () => void;
  setExpression: (expr: { id: string; latex: string }) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
  setMathBounds: (bounds: {
    left: number;
    right: number;
    bottom: number;
    top: number;
  }) => void;
}

interface DesmosEmbedProps {
  isVisible: boolean;
  onClose: () => void;
}

const DESMOS_SCRIPT_SRC = 'https://www.desmos.com/api/v1.8/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';

let scriptLoaded = false;
let scriptLoading = false;
const scriptCallbacks: (() => void)[] = [];

function loadDesmosScript(onLoad: () => void) {
  if (scriptLoaded) {
    onLoad();
    return;
  }
  if (scriptLoading) {
    scriptCallbacks.push(onLoad);
    return;
  }
  scriptLoading = true;
  scriptCallbacks.push(onLoad);

  const script = document.createElement('script');
  script.src = DESMOS_SCRIPT_SRC;
  script.async = true;
  script.onload = () => {
    scriptLoaded = true;
    scriptLoading = false;
    scriptCallbacks.forEach((cb) => cb());
    scriptCallbacks.length = 0;
  };
  script.onerror = () => {
    scriptLoading = false;
    console.error('Failed to load Desmos API');
  };
  document.head.appendChild(script);
}

export function DesmosEmbed({ isVisible, onClose }: DesmosEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<DesmosCalculator | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const initCalculator = useCallback(() => {
    if (!containerRef.current || !window.Desmos) return;
    if (calcRef.current) return; // already initialized

    try {
      calcRef.current = window.Desmos.GraphingCalculator(containerRef.current, {
        keypad: true,
        expressions: true,
        settingsMenu: false,
        zoomButtons: true,
        expressionsTopbar: true,
        pointsOfInterest: true,
        trace: true,
        border: false,
        lockViewport: false,
        autosize: true,
      });
      setIsLoading(false);
    } catch (err) {
      console.error('Desmos init error:', err);
      setLoadError(true);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    loadDesmosScript(() => {
      // Short delay to allow the container to be rendered
      setTimeout(initCalculator, 100);
    });

    return () => {
      if (calcRef.current) {
        try {
          calcRef.current.destroy();
        } catch {
          // ignore
        }
        calcRef.current = null;
        setIsLoading(true);
      }
    };
  }, [isVisible, initCalculator]);

  if (!isVisible) return null;

  const panelClass = isExpanded
    ? 'fixed inset-4 z-50 rounded-2xl shadow-2xl overflow-hidden flex flex-col bg-white border border-slate-200'
    : 'fixed bottom-4 right-4 z-50 w-[480px] h-[400px] rounded-2xl shadow-2xl overflow-hidden flex flex-col bg-white border border-slate-200';

  return (
    <>
      {/* Backdrop when expanded */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <div className={panelClass}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 text-white shrink-0">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold">Desmos Graphing Calculator</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded((e) => !e)}
              className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700 rounded"
              title={isExpanded ? 'Minimize' : 'Expand'}
            >
              {isExpanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700 rounded"
              title="Close calculator"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Calculator area */}
        <div className="flex-1 relative min-h-0">
          {isLoading && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-sm">Loading calculator...</p>
              </div>
            </div>
          )}
          {loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="text-center space-y-2">
                <p className="text-slate-500 text-sm">Could not load Desmos.</p>
                <p className="text-slate-400 text-xs">Check your internet connection.</p>
              </div>
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" />
        </div>
      </div>
    </>
  );
}
