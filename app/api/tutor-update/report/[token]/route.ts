/**
 * GET /api/tutor-update/report/[token]
 *
 * Public endpoint — no auth required.
 * Validates the token, increments view_count, returns a curated report payload.
 * Returns 404 if token not found, 410 if expired.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchTutorReport } from '@/lib/tutor-report';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  const result = await fetchTutorReport(token);

  if (result.status === 404) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }
  if (result.status === 410) {
    return NextResponse.json({ error: 'Report expired' }, { status: 410 });
  }

  return NextResponse.json(result.data);
}
