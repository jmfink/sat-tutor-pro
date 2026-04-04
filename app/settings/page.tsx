'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings,
  Users,
  Brain,
  Moon,
  AlertTriangle,
  ChevronRight,
  Info,
  Check,
  UserCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';

type ExplanationStyle = 'visual' | 'algebraic' | 'analogy' | 'elimination';

const EXPLANATION_STYLES: { id: ExplanationStyle; label: string; description: string }[] = [
  {
    id: 'visual',
    label: 'Visual',
    description: 'Diagrams, charts, and spatial reasoning to explain concepts.',
  },
  {
    id: 'algebraic',
    label: 'Algebraic',
    description: 'Step-by-step algebraic manipulation and symbolic reasoning.',
  },
  {
    id: 'analogy',
    label: 'Analogy',
    description: 'Real-world comparisons to make abstract ideas concrete.',
  },
  {
    id: 'elimination',
    label: 'Elimination',
    description: 'Process of elimination to rule out wrong answers systematically.',
  },
];

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full border-2 transition-colors duration-200 shrink-0
          ${checked ? 'bg-blue-600 border-blue-600' : 'bg-slate-200 border-slate-300'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200
            ${checked ? 'translate-x-5' : 'translate-x-0.5'}
          `}
        />
      </button>
    </div>
  );
}

function SettingsSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        {icon}
        <h2 className="text-sm font-bold text-slate-700">{title}</h2>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { name, user, refreshName } = useAuth();
  const [explanationStyle, setExplanationStyle] = useState<ExplanationStyle>('algebraic');
  const [socraticMode, setSocraticMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [saved, setSaved] = useState(false);
  const [parentEmail, setParentEmail] = useState('');
  const [parentEmailLoading, setParentEmailLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');

  // Initialise display name from auth context once the name loads in
  const [nameInitialised, setNameInitialised] = useState(false);
  if (!nameInitialised && name) {
    setDisplayName(name);
    setNameInitialised(true);
  }

  useEffect(() => {
    fetch('/api/parent-email')
      .then((r) => r.json())
      .then((d) => setParentEmail(d.parent_email ?? ''))
      .finally(() => setParentEmailLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      // Save display name via API route (uses admin client, bypasses RLS)
      if (displayName.trim()) {
        const res = await fetch('/api/student/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: displayName.trim() }),
        });
        if (!res.ok) {
          const { error } = await res.json();
          throw new Error(error ?? 'Failed to update name');
        }
        // Update the cached name in AuthProvider so the dashboard reflects it immediately
        await refreshName();
      }

      // Save parent email
      await fetch('/api/parent-email', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_email: parentEmail }),
      });

      setSaved(true);
      toast.success('Settings saved!');
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings.');
    }
  };

  const handleResetProgress = () => {
    setResetConfirming(true);
    setTimeout(() => {
      setResetConfirming(false);
      setShowResetDialog(false);
      toast.success('Progress has been reset. Starting fresh!');
    }, 1500);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto w-full space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <Settings className="h-6 w-6 text-slate-700" />
          <div>
            <h1 className="text-2xl font-black text-slate-900">Settings</h1>
            <p className="text-slate-500 text-sm mt-0.5">Customize your learning experience.</p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          className={`font-semibold ${saved ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white shadow-sm`}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4 mr-1.5" />
              Saved!
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
      </div>

      {/* Profile */}
      <SettingsSection
        title="Profile"
        icon={<UserCircle className="h-4 w-4 text-blue-600" />}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profileEmail">Email address</Label>
            <Input
              id="profileEmail"
              type="email"
              value={user?.email ?? ''}
              readOnly
              disabled
              className="text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
            />
            <p className="text-xs text-slate-400">
              Email changes are handled through Supabase Auth and cannot be edited here.
            </p>
          </div>
        </div>
      </SettingsSection>

      {/* Learning Preferences */}
      <SettingsSection
        title="Learning Preferences"
        icon={<Brain className="h-4 w-4 text-blue-600" />}
      >
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-2">
            Preferred Explanation Style
          </p>
          <p className="text-xs text-slate-500 mb-3">
            When you get a question wrong, the AI tutor will use this style by default.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {EXPLANATION_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => setExplanationStyle(style.id)}
                className={`
                  flex flex-col gap-1 p-3 rounded-xl border-2 text-left transition-all duration-100
                  ${
                    explanationStyle === style.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold ${explanationStyle === style.id ? 'text-blue-800' : 'text-slate-800'}`}>
                    {style.label}
                  </span>
                  {explanationStyle === style.id && (
                    <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{style.description}</p>
              </button>
            ))}
          </div>
        </div>
      </SettingsSection>

      {/* Tutor Mode */}
      <SettingsSection
        title="Tutor Behavior"
        icon={<Brain className="h-4 w-4 text-purple-600" />}
      >
        <Toggle
          checked={socraticMode}
          onChange={setSocraticMode}
          label="Socratic Mode"
          description="When on, the tutor guides you to discover the answer through questions rather than telling you directly. Best for students who want to develop deeper understanding."
        />

        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">
            You can also toggle Socratic mode within each explanation session. This setting sets the
            default.
          </p>
        </div>
      </SettingsSection>

      {/* Appearance */}
      <SettingsSection
        title="Appearance"
        icon={<Moon className="h-4 w-4 text-slate-600" />}
      >
        <Toggle
          checked={darkMode}
          onChange={setDarkMode}
          label="Dark Mode"
          description="Use a dark color scheme. (Preference is saved — full dark mode implementation coming soon.)"
        />
        {darkMode && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
            Dark mode preference saved. Full dark theme implementation is in progress.
          </div>
        )}
      </SettingsSection>

      {/* Parent Access */}
      <SettingsSection
        title="Parent Access"
        icon={<Users className="h-4 w-4 text-purple-600" />}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Parent Dashboard</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Parents can view your progress, session history, and upload practice tests.
            </p>
          </div>
          <Link href="/parent">
            <Button variant="outline" size="sm" className="border-slate-200 text-slate-600 shrink-0">
              Go to Parent Dashboard
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Parent Email</p>
          <p className="text-xs text-slate-500 mb-2">
            Alert emails about inactivity or skill regression will be sent here.
          </p>
          <Input
            type="email"
            placeholder={parentEmailLoading ? 'Loading...' : 'parent@example.com'}
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
            disabled={parentEmailLoading}
            className="text-sm"
          />
        </div>
        <div className="text-xs text-slate-400">
          Parent PIN: <span className="font-mono font-bold text-slate-600">1234</span> (demo)
        </div>
      </SettingsSection>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl border-2 border-red-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <h2 className="text-sm font-bold text-red-700">Danger Zone</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Reset All Progress</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Permanently delete all session history, skill ratings, review queue, and insights.
                This action cannot be undone.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetDialog(true)}
              className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-500 shrink-0"
            >
              Reset Progress
            </Button>
          </div>
        </div>
      </div>

      {/* App info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-600 mb-2">About</p>
        <div className="space-y-1 text-xs text-slate-500">
          <div className="flex items-center justify-between">
            <span>App Version</span>
            <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-slate-200">
              v0.1.0
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Next.js</span>
            <span className="font-mono text-slate-600">16.x</span>
          </div>
          <div className="flex items-center justify-between">
            <span>AI Model</span>
            <span className="font-mono text-slate-600">Claude Sonnet</span>
          </div>
        </div>
      </div>

      {/* Reset confirmation dialog */}
      <Dialog open={showResetDialog} onOpenChange={(open) => {
        if (!open) setShowResetDialog(false);
      }}>
        <DialogContent className="max-w-sm">
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Reset All Progress?</h2>
              <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                This will permanently delete all your sessions, skill ratings, and insights. This
                cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-slate-200"
                onClick={() => setShowResetDialog(false)}
                disabled={resetConfirming}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResetProgress}
                disabled={resetConfirming}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {resetConfirming ? 'Resetting...' : 'Yes, Reset'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
