import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');

  if (!studentId) {
    return NextResponse.json({ error: 'studentId required' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  // Fetch last 90 days of activity
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: activity, error } = await supabase
    .from('daily_activity')
    .select('*')
    .eq('student_id', studentId)
    .gte('activity_date', ninetyDaysAgo.toISOString().split('T')[0])
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
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const startOffset = activeDates.has(todayStr) ? 0 : 1;
  for (let i = startOffset; i < 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
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
