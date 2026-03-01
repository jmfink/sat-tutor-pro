'use client';

import { usePathname } from 'next/navigation';
import { Nav } from '@/components/nav';

const DEMO_STUDENT_ID = '00000000-0000-0000-0000-000000000001';

export function NavWrapper() {
  const pathname = usePathname();
  return <Nav currentPath={pathname} studentId={DEMO_STUDENT_ID} />;
}
