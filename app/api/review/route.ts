import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getNextReviewDate, formatDateForDB } from '@/lib/spaced-repetition';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  const countOnly = searchParams.get('countOnly') === 'true';

  if (!studentId) {
    return NextResponse.json({ error: 'studentId required' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('review_queue')
    .select(`
      *,
      question:questions (*)
    `)
    .eq('student_id', studentId)
    .lte('next_review_date', today)
    .order('next_review_date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (countOnly) return NextResponse.json({ count: (data || []).length });
  return NextResponse.json(data || []);
}

// Record a review result and update schedule
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Accept both camelCase and snake_case field names from the frontend
    const { reviewId, review_item_id, wasCorrect, is_correct } = body;
    const effectiveReviewId = reviewId ?? review_item_id;
    const effectiveWasCorrect = wasCorrect ?? is_correct;

    const supabase = createSupabaseServerClient();

    const { data: item } = await supabase
      .from('review_queue')
      .select('*')
      .eq('id', effectiveReviewId)
      .single();

    if (!item) return NextResponse.json({ error: 'Review item not found' }, { status: 404 });

    const nextDate = getNextReviewDate(item, effectiveWasCorrect);

    // If mastered (3+ correct reviews), remove from queue
    const newReviewCount = item.review_count + (effectiveWasCorrect ? 1 : 0);
    if (newReviewCount >= 4) {
      await supabase.from('review_queue').delete().eq('id', effectiveReviewId);
      return NextResponse.json({ mastered: true });
    }

    const { data: updated, error } = await supabase
      .from('review_queue')
      .update({
        next_review_date: formatDateForDB(nextDate),
        review_count: effectiveWasCorrect ? item.review_count + 1 : 0,
        last_review_result: effectiveWasCorrect,
        interval_days: effectiveWasCorrect ? (item.review_count === 0 ? 1 : item.review_count === 1 ? 3 : item.review_count === 2 ? 7 : 21) : 1,
      })
      .eq('id', effectiveReviewId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
