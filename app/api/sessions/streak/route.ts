import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');

  if (!studentId) {
    return NextResponse.json({ error: 'studentId required' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  // Accept the client's local date so streak is computed in the user's timezone,
  // not the server's UTC. Falls back to UTC if the client doesn't send it.
  const localDate = searchParams.get('localDate');

  // Helper: add/subtract days from a YYYY-MM-DD string without UTC drift.
  function shiftDate(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  const todayStr = localDate || new Date().toISOString().split('T')[0];
  const ninetyDaysAgoStr = shiftDate(todayStr, -90);

  const { data: activity, error } = await supabase
    .from('daily_activity')
    .select('*')
    .eq('student_id', studentId)
    .gte('activity_date', ninetyDaysAgoStr)
    .order('activity_date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const activeDates = new Set(
    (activity || [])
      .filter((a) => (a.questions_answered ?? 0) > 0)
      .map((a) => a.activity_date)
  );

  // Count consecutive days ending today (or yesterday if today has no activity yet).
  // This prevents the streak from resetting to 0 just because the student hasn't
  // studied yet today — their streak from prior days is preserved.
  let currentStreak = 0;
  const startOffset = activeDates.has(todayStr) ? 0 : 1;
  for (let i = startOffset; i < 90; i++) {
    const dateStr = shiftDate(todayStr, -i);
    if (activeDates.has(dateStr)) {
      currentStreak++;
    } else {
      break;
    }
  }

  return NextResponse.json({
    currentStreak,
    dailyActivity: activity || [],
  });
}
