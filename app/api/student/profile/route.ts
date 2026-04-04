import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, createSupabaseAdminClient } from '@/lib/supabase';

/** GET /api/student/profile — return name and email for the authenticated student */
export async function GET() {
  const authClient = await createSupabaseRouteHandlerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('students')
    .select('name, email')
    .eq('id', user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ name: data?.name ?? null, email: data?.email ?? user.email });
}

/** PATCH /api/student/profile — update display name for the authenticated student */
export async function PATCH(req: NextRequest) {
  const authClient = await createSupabaseRouteHandlerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : null;

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('students')
    .update({ name })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ name });
}
