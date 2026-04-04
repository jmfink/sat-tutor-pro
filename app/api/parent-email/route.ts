import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseRouteHandlerClient } from '@/lib/supabase';

/** GET /api/parent-email — return current parent_email for authenticated student */
export async function GET() {
  const supabase = await createSupabaseRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('students')
    .select('parent_email')
    .eq('id', user.id)
    .single();
  return NextResponse.json({ parent_email: data?.parent_email ?? null });
}

/** PATCH /api/parent-email — update parent_email */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { parent_email } = await req.json();
    const admin = createSupabaseAdminClient();

    await admin
      .from('students')
      .update({ parent_email })
      .eq('id', user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
