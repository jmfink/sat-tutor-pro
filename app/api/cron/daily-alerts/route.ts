/**
 * GET /api/cron/daily-alerts
 *
 * Vercel cron job — runs daily at 9am UTC (configured in vercel.json).
 * Iterates all students who have a parent_email set and triggers the
 * /api/alerts/check endpoint for each one.
 *
 * Vercel authenticates cron requests with:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Set CRON_SECRET in the Vercel dashboard (any random string works).
 * Set NEXT_PUBLIC_APP_URL to your production domain (e.g. https://sat-tutor-pro.vercel.app).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();

  const { data: students, error } = await supabase
    .from('students')
    .select('id')
    .not('parent_email', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!students?.length) {
    return NextResponse.json({ sent: 0, message: 'No students with parent emails configured' });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const results: { studentId: string; sent?: boolean; reason?: string; error?: string }[] = [];

  for (const student of students) {
    try {
      const res = await fetch(`${appUrl}/api/alerts/check?studentId=${student.id}`);
      const data = (await res.json()) as { sent?: boolean; reason?: string };
      results.push({ studentId: student.id, sent: data.sent, reason: data.reason });
    } catch (err) {
      results.push({ studentId: student.id, error: String(err) });
    }
  }

  return NextResponse.json({ processed: students.length, results });
}
