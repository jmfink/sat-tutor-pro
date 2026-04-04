'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Star,
  TrendingUp,
  Clock,
  Settings,
  ChevronRight,
  Zap,
  Users,
  LogOut,
  HelpCircle,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';

interface NavProps {
  currentPath: string;
  studentId: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  badgeStyle?: string;
  exactMatch?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: <LayoutDashboard className="h-4 w-4" />,
    exactMatch: true,
  },
  {
    label: 'Study Session',
    href: '/study',
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    label: 'Practice Test',
    href: '/practice-test',
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    label: 'Wrong Answer Insights',
    href: '/insights',
    icon: <Star className="h-4 w-4" />,
    badge: '★',
    badgeStyle: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  {
    label: 'My Progress',
    href: '/progress',
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    label: 'Review Queue',
    href: '/review',
    icon: <Clock className="h-4 w-4" />,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="h-4 w-4" />,
  },
];

export function Nav({ currentPath, studentId }: NavProps) {
  const [predictedScore, setPredictedScore] = useState<number | null>(null);
  const [scoreLoaded, setScoreLoaded] = useState(false);
  const router = useRouter();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  useEffect(() => {
    if (!studentId) return;
    fetch(`/api/claude/predict-score?studentId=${studentId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.total_score_mid) {
          setPredictedScore(data.total_score_mid);
        }
      })
      .catch(() => {})
      .finally(() => setScoreLoaded(true));
  }, [studentId]);

  const isActive = (item: NavItem) => {
    if (item.exactMatch) {
      return currentPath === item.href;
    }
    return currentPath.startsWith(item.href);
  };

  return (
    <nav className="flex flex-col h-full w-full bg-white border-r border-slate-200">
      {/* Brand */}
      <div className="px-4 py-5 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-black text-slate-800 leading-none">SAT Tutor Pro</p>
          <p className="text-[10px] text-slate-400 italic mt-0.5">Your AI coach</p>
        </div>
      </div>

      <Separator />

      {/* Nav links */}
      <div className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-100 no-underline
                ${
                  active
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }
              `}
              aria-current={active ? 'page' : undefined}
            >
              <span
                className={`transition-colors ${
                  active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              >
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span
                  className={`
                    text-[11px] font-semibold px-1.5 py-0.5 rounded border
                    ${item.badgeStyle ?? 'bg-slate-100 text-slate-500 border-slate-200'}
                  `}
                >
                  {item.badge}
                </span>
              )}
              {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
            </Link>
          );
        })}

        <Separator className="my-2" />

        {/* Help link */}
        <Link
          href="/help"
          className={`
            group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
            transition-all duration-100 no-underline
            ${
              currentPath === '/help'
                ? 'bg-blue-50 text-blue-700 shadow-sm'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }
          `}
        >
          <span
            className={`transition-colors ${
              currentPath === '/help'
                ? 'text-blue-600'
                : 'text-slate-400 group-hover:text-slate-600'
            }`}
          >
            <HelpCircle className="h-4 w-4" />
          </span>
          <span className="flex-1">User Guide</span>
        </Link>

        {/* Parent dashboard link */}
        <Link
          href="/parent"
          className={`
            group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
            transition-all duration-100 no-underline
            ${
              currentPath === '/parent'
                ? 'bg-purple-50 text-purple-700 shadow-sm'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }
          `}
        >
          <span
            className={`transition-colors ${
              currentPath === '/parent'
                ? 'text-purple-600'
                : 'text-slate-400 group-hover:text-slate-600'
            }`}
          >
            <Users className="h-4 w-4" />
          </span>
          <span className="flex-1">Parent Dashboard</span>
        </Link>
      </div>

      <Separator />

      {/* Score prediction footer */}
      <div className="px-4 py-4 space-y-2">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Predicted Score
        </p>
        {predictedScore !== null ? (
          <div className="flex items-end gap-1.5">
            <span className="text-2xl font-black text-slate-800">{predictedScore}</span>
            <span className="text-sm text-slate-400 mb-0.5">/ 1600</span>
          </div>
        ) : scoreLoaded ? (
          <p className="text-xs text-slate-400 leading-relaxed">Complete 20 questions to unlock</p>
        ) : (
          <div className="h-8 bg-slate-100 rounded-md animate-pulse" />
        )}
        <Link
          href="/progress"
          className="text-[11px] text-blue-500 hover:text-blue-700 font-medium flex items-center gap-0.5 no-underline"
        >
          View progress
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <Separator />
      <div className="px-4 py-3">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </nav>
  );
}
