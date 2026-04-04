'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronRight } from 'lucide-react';

const SECTIONS = [
  { id: 'section-1', label: '1. Start Here in 60 Seconds' },
  { id: 'section-2', label: '2. What Makes This Different' },
  { id: 'section-3', label: '3. Getting Started' },
  { id: 'section-4', label: '4. Session Types' },
  { id: 'section-5', label: '5. How to Learn Fast' },
  { id: 'section-6', label: '6. Wrong Answer Insights' },
  { id: 'section-7', label: '7. Progress and Motivation' },
  { id: 'section-8', label: '8. Troubleshooting (Beta)' },
  { id: 'section-9', label: '9. Quick Reference' },
];

function Callout({ children, variant = 'info' }: { children: React.ReactNode; variant?: 'info' | 'tip' }) {
  const styles = variant === 'tip'
    ? 'bg-amber-50 border-amber-200 text-amber-900'
    : 'bg-blue-50 border-blue-200 text-blue-900';
  return (
    <div className={`border rounded-lg px-4 py-3 my-4 text-sm leading-relaxed ${styles}`}>
      {children}
    </div>
  );
}

function SectionHeader({ id, number, title }: { id: string; number: number; title: string }) {
  return (
    <h2
      id={id}
      className="flex items-center gap-3 text-xl font-black text-slate-900 mb-4 scroll-mt-6"
    >
      <span
        className="flex items-center justify-center w-8 h-8 rounded-lg text-sm font-black text-white shrink-0"
        style={{ backgroundColor: '#1E3A5F' }}
      >
        {number}
      </span>
      {title}
    </h2>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mt-5 mb-2">
      {children}
    </h3>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 my-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#B8860B' }} />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState('section-1');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-10% 0px -80% 0px' }
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header bar */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <BookOpen className="h-5 w-5" style={{ color: '#1E3A5F' }} />
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-none">User Guide</h1>
            <p className="text-xs text-slate-400 mt-0.5">SAT Tutor Pro</p>
          </div>
          <div className="ml-auto">
            <Link
              href="/"
              className="flex items-center gap-1 text-xs font-medium no-underline"
              style={{ color: '#1E3A5F' }}
            >
              Back to app <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto flex gap-0">
        {/* Sticky sidebar */}
        <aside className="hidden md:block w-64 shrink-0">
          <div className="sticky top-0 h-screen overflow-y-auto py-6 px-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 px-2">
              Contents
            </p>
            <nav className="space-y-0.5">
              {SECTIONS.map(({ id, label }) => {
                const active = activeSection === id;
                return (
                  <button
                    key={id}
                    onClick={() => scrollTo(id)}
                    className={`
                      w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all duration-100
                      ${active
                        ? 'text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }
                    `}
                    style={active ? { backgroundColor: '#1E3A5F' } : undefined}
                  >
                    {label}
                  </button>
                );
              })}
            </nav>

            <div className="mt-6 border-t border-slate-200 pt-4 px-2">
              <p className="text-[10px] text-slate-400 leading-relaxed italic">
                Your AI-powered personal SAT tutor. Built to turn practice into measurable score gains.
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile section nav */}
        <div className="md:hidden w-full px-4 pt-4">
          <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Jump to section
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SECTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="text-xs px-2.5 py-1 rounded-md font-medium border transition-colors"
                  style={{ borderColor: '#1E3A5F', color: '#1E3A5F' }}
                >
                  {label.split('.')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6 space-y-10">

          {/* Section 1 */}
          <section>
            <SectionHeader id="section-1" number={1} title="Start Here in 60 Seconds" />
            <SubHead>Default weekly plan (the &quot;get into a great university&quot; plan)</SubHead>
            <BulletList items={[
              '5 days/week: Study Session (25 minutes)',
              '2 days/week: Timed Section (1 section)',
              'Every 2–3 weeks: Full Practice Test (2+ hours)',
            ]} />
            <SubHead>3 rules that drive score gains</SubHead>
            <BulletList items={[
              'Confidence every time. Guessing / Okay / Confident',
              'Wrong answer equals points. 60 seconds in Guide me (Socratic), then use Just tell me if needed',
              'No tilt spiral. Reset, then continue',
            ]} />
            <Callout variant="tip">
              <p className="font-bold mb-1">30-second reset (Tilt Protocol)</p>
              In 4 seconds. Out 6 seconds. Twice. Then say: &quot;New question. Clean slate.&quot;
            </Callout>
          </section>

          <div className="border-t border-slate-200" />

          {/* Section 2 */}
          <section>
            <SectionHeader id="section-2" number={2} title="What Makes This Different" />
            <p className="text-sm text-slate-700 leading-relaxed mb-3">
              Basic apps give generic practice. Human tutors can be great, but they only see a slice of your work.
              SAT Tutor Pro compounds because it learns you. It uses your full practice history to adapt what you
              see next and how it teaches.
            </p>
            <BulletList items={[
              'Real-time personalization: questions and focus areas adjust as you go',
              'Better learning loop: Socratic coaching builds durable skill, not memorized answers',
              'Pattern detection: finds repeatable mistakes that are hard to see yourself',
            ]} />
            <SubHead>About &quot;AI remembers&quot; and &quot;tracks your answers&quot;</SubHead>
            <p className="text-sm text-slate-700 leading-relaxed">
              This is personalization, not surveillance. It keeps your practice history and your in-session
              context so you get tighter coaching and better recommendations.
            </p>
          </section>

          <div className="border-t border-slate-200" />

          {/* Section 3 */}
          <section>
            <SectionHeader id="section-3" number={3} title="Getting Started" />
            <SubHead>Launch the app</SubHead>
            <BulletList items={[
              'Go to sat-tutor-pro.vercel.app in your browser',
              'Sign in with your email and password',
              'If you don\'t have an account, click Sign Up and create one',
            ]} />
            <Callout>
              The app runs in your browser — no installation needed. Works on any laptop or desktop.
            </Callout>
          </section>

          <div className="border-t border-slate-200" />

          {/* Section 4 */}
          <section>
            <SectionHeader id="section-4" number={4} title="Session Types" />

            {[
              {
                name: 'Study Session',
                tag: 'Default',
                tagColor: '#1E3A5F',
                desc: '25–45 minutes. Adaptive across skills. Explanations after every question. Use this most often.',
              },
              {
                name: 'Quick Drill',
                tag: '~10 min',
                tagColor: '#B8860B',
                desc: '10 questions. About 10 minutes. One skill. Great when time is tight.',
              },
              {
                name: 'Timed Section',
                tag: 'Stamina',
                tagColor: '#4B5563',
                desc: 'One section. Test conditions. Builds pacing and stamina. Use 1–2x/week.',
              },
              {
                name: 'Full Practice Test',
                tag: '2+ hours',
                tagColor: '#6B21A8',
                desc: 'Full 2+ hour simulation. Best measurement tool. Use every 2–3 weeks. Desktop or laptop recommended.',
              },
            ].map((s) => (
              <div key={s.name} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-slate-900">{s.name}</p>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: s.tagColor }}
                  >
                    {s.tag}
                  </span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </section>

          <div className="border-t border-slate-200" />

          {/* Section 5 */}
          <section>
            <SectionHeader id="section-5" number={5} title="How to Learn Fast (during sessions)" />

            <SubHead>Confidence selector</SubHead>
            <p className="text-sm text-slate-700 leading-relaxed mb-3">
              Always set confidence before submitting your answer. It tells the tutor whether you truly know it,
              got lucky, or are guessing. That makes the next questions and coaching smarter.
            </p>

            <SubHead>Wrong answers</SubHead>
            <p className="text-sm text-slate-700 leading-relaxed mb-2">
              Do not rush past misses. The score moves when you fix repeatable patterns.
            </p>
            <BulletList items={[
              'Guide me (Socratic Mode): try first. It builds skill that transfers to new questions',
              'Just tell me (Direct Mode): use when stuck or short on time',
            ]} />

            <SubHead>Timed test habits that win points</SubHead>
            <BulletList items={[
              'Two-pass approach: grab fast points first, return to sticky ones later',
              'Eliminate before guessing: remove 1–2 choices, then answer and mark Guessing',
              'Trap awareness: wrong answers are engineered to feel right when you rush',
            ]} />
          </section>

          <div className="border-t border-slate-200" />

          {/* Section 6 */}
          <section>
            <SectionHeader id="section-6" number={6} title="Wrong Answer Insights ★" />
            <p className="text-sm text-slate-700 leading-relaxed mb-3">
              After at least 10 wrong answers, the app analyzes your mistakes across 8 dimensions to surface
              patterns. This is where AI beats a basic app. It can learn from your entire history and quantify
              what is holding you back.
            </p>

            <SubHead>Weekly ritual</SubHead>
            <p className="text-sm text-slate-700 leading-relaxed mb-3">
              Once per week: open Navigation → Wrong Answer Insights. Pick 1 focus area for the week.
              Then use Study Session or Quick Drill to attack it.
            </p>

            <SubHead>What it measures (in plain English)</SubHead>
            <BulletList items={[
              'What kinds of mistakes you make (concept, careless, trap, misread)',
              'Where you lose points (skills and formats)',
              'When performance drops (timing, tilt, confidence)',
            ]} />

            <Callout>
              <p className="font-bold mb-1">Nerd note (optional)</p>
              The system maintains ratings per sub-skill and uses them to estimate your predicted score.
              More sessions equals better signal.
            </Callout>
          </section>

          <div className="border-t border-slate-200" />

          {/* Section 7 */}
          <section>
            <SectionHeader id="section-7" number={7} title="Progress and Motivation" />

            <SubHead>Predicted Score</SubHead>
            <BulletList items={[
              'Updates after every session',
              'Early range is wide. After 5–10 sessions it tightens',
              'Track the trend, not the day-to-day noise',
            ]} />

            <SubHead>Skill Map, Daily Streak, Review Queue</SubHead>
            <BulletList items={[
              'Skill Map: see what is weak and what is improving',
              'Daily Streak: consistency beats intensity. Quick Drill counts',
              'Review Queue: spaced repetition. This converts old mistakes into permanent points',
            ]} />
          </section>

          <div className="border-t border-slate-200" />

          {/* Section 8 */}
          <section>
            <SectionHeader id="section-8" number={8} title="Troubleshooting (Beta)" />
            <p className="text-sm text-slate-700 leading-relaxed mb-4">
              This is a beta product. Bugs and feedback are part of improving it.
              When something breaks, capture details.
            </p>

            {[
              {
                q: "App won't load",
                a: "Try refreshing the browser. If the problem persists, clear your browser cache and try again. If it still doesn't work, contact your app administrator.",
              },
              {
                q: 'No questions available',
                a: 'Contact your app administrator — the question bank may need to be reloaded.',
              },
              {
                q: 'Question looks garbled or explanation seems wrong',
                a: 'Click the 👎 button on the question card or explanation panel to flag it for review. This helps improve the question bank.',
              },
              {
                q: 'Forgot your password',
                a: 'Click "Forgot password?" on the login page. A reset link will be sent to your email.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-3">
                <p className="text-sm font-bold text-slate-900 mb-1">{q}</p>
                <p className="text-sm text-slate-600 leading-relaxed">{a}</p>
              </div>
            ))}

            <SubHead>What to report so it gets fixed fast</SubHead>
            <BulletList items={[
              'What you were doing (Study Session, Timed Section, etc.)',
              'What you clicked right before it happened',
              'What you expected vs what happened',
              'Screenshot of the page',
              'Time it happened',
            ]} />
          </section>

          <div className="border-t border-slate-200" />

          {/* Section 9 */}
          <section>
            <SectionHeader id="section-9" number={9} title="Quick Reference" />
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#1E3A5F' }}>
                    <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase tracking-wide">
                      What you want to do
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-white text-xs uppercase tracking-wide">
                      How to do it
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['Sign in', 'Go to sat-tutor-pro.vercel.app'],
                    ['Daily practice', 'Dashboard → Study Session'],
                    ['Quick drill', 'Dashboard → Quick Drill → choose a skill'],
                    ['Full practice test', 'Dashboard → Practice Test'],
                    ['Check patterns', 'Navigation → Wrong Answer Insights'],
                    ['Reset your password', 'Login page → Forgot password?'],
                    ['Update your name', 'Settings → Profile'],
                    ['Flag a bad question', 'Click 👎 on any question card'],
                  ].map(([what, how], i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-4 py-3 text-slate-800 font-medium">{what}</td>
                      <td className="px-4 py-3 text-slate-600">{how}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Footer */}
          <div className="border-t border-slate-200 pt-6 pb-10">
            <p className="text-sm text-center italic" style={{ color: '#B8860B' }}>
              Every wrong answer is future points, if you learn the pattern behind it.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
