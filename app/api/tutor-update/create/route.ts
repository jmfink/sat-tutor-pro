/**
 * POST /api/tutor-update/create
 *
 * Auth required. Creates or reuses a tutor share link for the current student.
 * If an unexpired link exists, it is reused. Otherwise a new one is created.
 *
 * Body: { tutor_name?: string, tutor_contact?: string, contact_type?: string }
 * Returns: { token, share_url, expires_at }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, createSupabaseAdminClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    // Identify the authenticated student
    const authClient = await createSupabaseRouteHandlerClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const studentId = user.id;

    const body = await req.json().catch(() => ({}));
    const { tutor_name, tutor_contact, contact_type } = body as {
      tutor_name?: string;
      tutor_contact?: string;
      contact_type?: string;
    };

    const admin = createSupabaseAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    // Check for an existing unexpired link for this student
    const { data: existing } = await admin
      .from('tutor_share_links')
      .select('id, token, expires_at, tutor_name, tutor_contact, contact_type')
      .eq('student_id', studentId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      // Update tutor info if provided, then reuse the link
      const updates: Record<string, string | undefined> = {};
      if (tutor_name !== undefined) updates.tutor_name = tutor_name;
      if (tutor_contact !== undefined) updates.tutor_contact = tutor_contact;
      if (contact_type !== undefined) updates.contact_type = contact_type;

      if (Object.keys(updates).length > 0) {
        await admin.from('tutor_share_links').update(updates).eq('id', existing.id);
      }

      return NextResponse.json({
        token: existing.token,
        share_url: `${appUrl}/report/${existing.token}`,
        expires_at: existing.expires_at,
      });
    }

    // Create a new link
    const { data: created, error: insertError } = await admin
      .from('tutor_share_links')
      .insert({
        student_id: studentId,
        tutor_name: tutor_name ?? null,
        tutor_contact: tutor_contact ?? null,
        contact_type: contact_type ?? null,
      })
      .select('token, expires_at')
      .single();

    if (insertError || !created) {
      console.error('tutor-update/create insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
    }

    return NextResponse.json({
      token: created.token,
      share_url: `${appUrl}/report/${created.token}`,
      expires_at: created.expires_at,
    });
  } catch (err) {
    console.error('tutor-update/create error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
