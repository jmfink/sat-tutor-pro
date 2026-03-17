import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { DEMO_STUDENT_ID } from '@/lib/constants';

/** GET /api/parent-email — return current parent_email for the demo student */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('students')
    .select('parent_email')
    .eq('id', DEMO_STUDENT_ID)
    .single();
  return NextResponse.json({ parent_email: data?.parent_email ?? null });
}

/** PATCH /api/parent-email — update parent_email */
export async function PATCH(req: NextRequest) {
  try {
    const { parent_email } = await req.json();
    const supabase = createSupabaseServerClient();

    // Upsert student row in case it doesn't exist yet
    await supabase
      .from('students')
      .upsert({ id: DEMO_STUDENT_ID, name: 'Student', parent_email }, { onConflict: 'id', ignoreDuplicates: false });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
