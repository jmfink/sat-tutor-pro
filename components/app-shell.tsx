'use client';

import { usePathname } from 'next/navigation';
import { NavWrapper } from '@/components/nav-wrapper';

const AUTH_ROUTES = ['/login', '/signup', '/forgot-password'];
// Routes where the sidebar is hidden for distraction-free focus
const FOCUS_ROUTE_PREFIXES = ['/study/', '/practice-test/'];
// Public standalone pages — no app chrome at all
const PUBLIC_ROUTE_PREFIXES = ['/report/'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const isFocusRoute = FOCUS_ROUTE_PREFIXES.some((p) => pathname.startsWith(p));
  const isPublicRoute = PUBLIC_ROUTE_PREFIXES.some((p) => pathname.startsWith(p));

  if (isAuthRoute || isFocusRoute || isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      {/* Fixed left sidebar — desktop only */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-60 flex-col border-r border-slate-200 bg-white shadow-sm">
        <NavWrapper />
      </aside>

      {/* Main content — offset on desktop */}
      <main className="flex-1 lg:pl-60 min-h-screen flex flex-col">
        {children}
      </main>
    </div>
  );
}
