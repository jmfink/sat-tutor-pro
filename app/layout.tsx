import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NavWrapper } from '@/components/nav-wrapper';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'SAT Tutor Pro',
  description: 'Adaptive SAT tutoring powered by AI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-slate-50 text-slate-900">
        <TooltipProvider delayDuration={300}>
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
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
