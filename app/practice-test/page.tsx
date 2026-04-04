'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardList,
  Clock,
  BookOpen,
  Calculator,
  ChevronRight,
  Info,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PracticeTestMeta {
  id: string;
  name: string;
  questionCount: number;
  mathCount: number;
  rwCount: number;
}

function ModuleChip({ label }: { label: string }) {
  const isMath = label.toLowerCase().includes('math');
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
        isMath
          ? 'bg-blue-100 text-blue-800 border-blue-300'
          : 'bg-sky-50 text-sky-700 border-sky-200'
      }`}
    >
      {isMath ? <Calculator className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
      {label}
    </span>
  );
}

export default function PracticeTestPage() {
  const router = useRouter();
  const [tests, setTests] = useState<PracticeTestMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/practice-tests')
      .then(r => r.ok ? r.json() : [])
      .then(setTests)
      .catch(() => setTests([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900">Practice Tests</h1>
        <p className="text-slate-500 text-sm mt-1">
          Simulate the real digital SAT experience with full timed tests.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">What to expect</p>
          <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
            Full tests have a 10-minute break between the Reading &amp; Writing and Math sections. No hints
            or explanations are shown during the test. You&apos;ll see a detailed score report when you finish.
            Use the Desmos calculator and formula sheet on math modules.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading available tests…</span>
        </div>
      ) : tests.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          No practice tests found. Upload College Board PDFs in the Parent Dashboard to add tests.
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map((test) => (
            <div
              key={test.id}
              className="flex flex-col md:flex-row gap-4 bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:border-blue-300 hover:shadow-md transition-all duration-150"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <ClipboardList className="h-6 w-6 text-blue-600" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="text-base font-bold text-slate-900">{test.name}</h2>
                    <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-xs">
                      Full Test
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Full SAT simulation with timed modules, passage annotation, and Desmos calculator.
                    Mirrors the real digital SAT format.
                  </p>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5 text-slate-400" />
                    {test.questionCount} questions available
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    ~2 hr 14 min
                  </span>
                </div>

                {/* Modules */}
                <div className="flex flex-wrap gap-1.5">
                  <ModuleChip label="RW Module 1 (27q)" />
                  <ModuleChip label="RW Module 2 (27q)" />
                  <ModuleChip label="Math Module 1 (22q)" />
                  <ModuleChip label="Math Module 2 (22q)" />
                </div>
              </div>

              {/* CTA */}
              <div className="flex items-center md:items-end md:flex-col gap-2 shrink-0">
                <Button
                  onClick={() => router.push(`/practice-test/${test.id}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
                >
                  Start Test
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            icon: <Clock className="h-5 w-5 text-orange-500" />,
            title: 'Set aside time',
            text: 'Full tests take over 2 hours. Clear your schedule and minimize distractions.',
          },
          {
            icon: <Calculator className="h-5 w-5 text-blue-500" />,
            title: 'Use the tools',
            text: 'The Desmos calculator and formula sheet are available during math modules — just like the real test.',
          },
          {
            icon: <BookOpen className="h-5 w-5 text-blue-500" />,
            title: 'Review after',
            text: 'After finishing, review the analysis page to understand every mistake.',
          },
        ].map((tip, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center">
              {tip.icon}
            </div>
            <p className="text-sm font-bold text-slate-800">{tip.title}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{tip.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
