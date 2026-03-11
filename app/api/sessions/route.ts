import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import type { SessionType, SubSkillId } from '@/types';

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

// Create a new session
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Accept both camelCase and snake_case keys from clients
    const studentId: string = body.studentId ?? body.student_id;
    const sessionType: SessionType = body.sessionType ?? body.session_type;
    const subSkillFocus: SubSkillId | undefined = body.subSkillFocus ?? body.sub_skill_focus;
    const metadata: Record<string, unknown> = body.metadata ?? {};

    if (!studentId || !sessionType) {
      return NextResponse.json({ error: 'studentId and sessionType are required' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    // Ensure student row exists (FK constraint: sessions.student_id → students.id)
    await supabase
      .from('students')
      .upsert({ id: studentId, name: 'Student' }, { onConflict: 'id', ignoreDuplicates: true });

    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        student_id: studentId,
        session_type: sessionType,
        sub_skill_focus: subSkillFocus || null,
        metadata,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(session);
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}

// Get sessions for a student
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!studentId) {
    return NextResponse.json({ error: 'studentId required' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  // Alternate mode: return skill ratings instead of sessions
  if (searchParams.get('skillRatings') === 'true') {
    const { data: ratings, error: ratingsError } = await supabase
      .from('skill_ratings')
      .select('*')
      .eq('student_id', studentId);
    if (ratingsError) return NextResponse.json({ error: ratingsError.message }, { status: 500 });
    return NextResponse.json({ skill_ratings: ratings || [] });
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('student_id', studentId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data || []);
}

// Update session (end it, add metadata)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, endedAt, moodSignals, subSkillsPracticed, metadata } = body;

    const supabase = createSupabaseServerClient();

    const updates: Record<string, unknown> = {};
    if (endedAt) updates.ended_at = endedAt;
    if (moodSignals) updates.mood_signals = moodSignals;
    if (subSkillsPracticed) updates.sub_skills_practiced = subSkillsPracticed;
    if (metadata) updates.metadata = metadata;

    const { data: session, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(session);
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}
