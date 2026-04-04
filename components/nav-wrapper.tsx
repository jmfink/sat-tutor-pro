'use client';

import { usePathname } from 'next/navigation';
import { Nav } from '@/components/nav';
import { useAuth } from '@/components/auth-provider';

export function NavWrapper() {
  const pathname = usePathname();
  const { userId } = useAuth();
  return <Nav currentPath={pathname} studentId={userId ?? ''} />;
}
