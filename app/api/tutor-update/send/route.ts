/**
 * POST /api/tutor-update/send
 *
 * Auth required. Sends the tutor update via the selected channel.
 *
 * Body: {
 *   token: string,
 *   contact_type: 'sms' | 'whatsapp' | 'email',
 *   contact_value: string,
 *   tutor_name?: string,
 * }
 *
 * For email: sends via Resend, returns { sent: true }
 * For sms: returns { deep_link: 'sms:...' }
 * For whatsapp: returns { deep_link: 'https://wa.me/...' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseRouteHandlerClient, createSupabaseAdminClient } from '@/lib/supabase';

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

function getWeekOfLabel(): string {
  // Monday of the current week
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function buildTutorEmailHtml(params: {
  studentName: string;
  shareUrl: string;
  tutorName: string | null;
  weekOf: string;
  predictedScore: number | null;
  rwScore: number | null;
  mathScore: number | null;
  daysPracticed: number;
  questionsThisWeek: number;
}) {
  const {
    studentName, shareUrl, tutorName, weekOf,
    predictedScore, rwScore, mathScore, daysPracticed, questionsThisWeek,
  } = params;

  const greeting = tutorName ? `Hi ${tutorName},` : 'Hi,';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>${studentName}'s SAT Tutor Update</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937;background:#f8fafc;">
  <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#1E3A5F;padding:24px 28px;">
      <div style="color:white;font-size:22px;font-weight:900;margin-bottom:4px;">SAT Tutor Pro</div>
      <div style="color:#93c5fd;font-size:14px;">${studentName}'s Tutor Update — week of ${weekOf}</div>
    </div>
    <div style="padding:24px 28px;">
      <p style="margin:0 0 16px;color:#374151;">${greeting}</p>
      <p style="margin:0 0 16px;color:#374151;">
        ${studentName} shared their weekly SAT practice update with you via SAT Tutor Pro.
        Here's a quick snapshot to help you prep for your next session.
      </p>

      ${predictedScore ? `
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 18px;flex:1;min-width:100px;text-align:center;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Predicted Score</div>
          <div style="font-size:28px;font-weight:900;color:#059669;">${predictedScore}</div>
          <div style="font-size:11px;color:#64748b;">out of 1600</div>
        </div>
        ${rwScore ? `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 18px;flex:1;min-width:100px;text-align:center;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Reading & Writing</div>
          <div style="font-size:28px;font-weight:900;color:#3b82f6;">${rwScore}</div>
          <div style="font-size:11px;color:#64748b;">out of 800</div>
        </div>` : ''}
        ${mathScore ? `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 18px;flex:1;min-width:100px;text-align:center;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Math</div>
          <div style="font-size:28px;font-weight:900;color:#3b82f6;">${mathScore}</div>
          <div style="font-size:11px;color:#64748b;">out of 800</div>
        </div>` : ''}
      </div>` : ''}

      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 18px;flex:1;min-width:100px;text-align:center;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Days Practiced</div>
          <div style="font-size:28px;font-weight:900;color:#1E3A5F;">${daysPracticed}/7</div>
          <div style="font-size:11px;color:#64748b;">this week</div>
        </div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 18px;flex:1;min-width:100px;text-align:center;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Questions Answered</div>
          <div style="font-size:28px;font-weight:900;color:#1E3A5F;">${questionsThisWeek}</div>
          <div style="font-size:11px;color:#64748b;">this week</div>
        </div>
      </div>

      <div style="margin-bottom:20px;">
        <a href="${shareUrl}" style="display:inline-block;background:#2563EB;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:15px;">
          View full report →
        </a>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
          This update was generated by SAT Tutor Pro, an AI-powered SAT practice app that tracks
          how ${studentName} gets things wrong — not just what they get wrong — to personalize every
          study session. <a href="https://sattutor.pro" style="color:#2563EB;">Learn more at sattutor.pro</a>
        </p>
      </div>

      <div style="border-top:1px solid #e5e7eb;padding-top:16px;font-size:12px;color:#94a3b8;text-align:center;">
        Generated by SAT Tutor Pro ·
        <a href="https://sattutor.pro" style="color:#3b82f6;">sattutor.pro</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    // Identify the authenticated student
    const authClient = await createSupabaseRouteHandlerClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { token, contact_type, contact_value, tutor_name } = body as {
      token: string;
      contact_type: 'sms' | 'whatsapp' | 'email';
      contact_value: string;
      tutor_name?: string;
    };

    if (!token || !contact_type || !contact_value) {
      return NextResponse.json({ error: 'token, contact_type, and contact_value required' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const shareUrl = `${appUrl}/report/${token}`;
    const weekOf = getWeekOfLabel();

    // Fetch link + student info
    const { data: link } = await admin
      .from('tutor_share_links')
      .select('id, student_id, tutor_name, expires_at')
      .eq('token', token)
      .single();

    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }
    if (new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Link expired' }, { status: 410 });
    }

    // Fetch student first name
    const { data: student } = await admin
      .from('students')
      .select('name')
      .eq('id', link.student_id)
      .single();

    const firstName = (student?.name ?? 'Your student').split(' ')[0];
    const resolvedTutorName = tutor_name ?? link.tutor_name ?? null;

    // Update last_sent_at
    await admin
      .from('tutor_share_links')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('id', link.id);

    // ── SMS ───────────────────────────────────────────────────────────────────
    if (contact_type === 'sms') {
      const message = `Hi ${resolvedTutorName ?? 'there'}, here's my SAT Tutor Pro update for this week — ${shareUrl} — feel free to use it to prep for our next session.`;
      const deepLink = `sms:${contact_value}?body=${encodeURIComponent(message)}`;
      return NextResponse.json({ sent: false, deep_link: deepLink, channel: 'sms' });
    }

    // ── WhatsApp ──────────────────────────────────────────────────────────────
    if (contact_type === 'whatsapp') {
      const e164 = toE164(contact_value);
      const message = `Hi ${resolvedTutorName ?? 'there'}, here's my SAT Tutor Pro update for this week — ${shareUrl} — feel free to use it to prep for our next session.`;
      const deepLink = `https://wa.me/${e164.replace('+', '')}?text=${encodeURIComponent(message)}`;
      return NextResponse.json({ sent: false, deep_link: deepLink, channel: 'whatsapp' });
    }

    // ── Email ─────────────────────────────────────────────────────────────────
    if (contact_type === 'email') {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey || apiKey.startsWith('re_placeholder')) {
        return NextResponse.json({
          sent: false,
          error: 'RESEND_API_KEY not configured.',
        });
      }

      // Fetch score snapshot for the email summary
      const { data: latestPred } = await admin
        .from('score_predictions')
        .select('total_score_mid, rw_score, math_score')
        .eq('student_id', link.student_id)
        .order('predicted_at', { ascending: false })
        .limit(1)
        .single();

      // Days practiced this week
      const weekStart = (() => {
        const now = new Date();
        const day = now.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const mon = new Date(now);
        mon.setDate(now.getDate() + diff);
        mon.setHours(0, 0, 0, 0);
        return mon.toISOString().split('T')[0];
      })();

      const { data: weekActivity } = await admin
        .from('daily_activity')
        .select('activity_date, questions_answered')
        .eq('student_id', link.student_id)
        .gte('activity_date', weekStart);

      const daysPracticed = weekActivity?.length ?? 0;
      const questionsThisWeek = weekActivity?.reduce((s, d) => s + (d.questions_answered ?? 0), 0) ?? 0;

      const html = buildTutorEmailHtml({
        studentName: firstName,
        shareUrl,
        tutorName: resolvedTutorName,
        weekOf,
        predictedScore: latestPred?.total_score_mid ?? null,
        rwScore: latestPred?.rw_score ?? null,
        mathScore: latestPred?.math_score ?? null,
        daysPracticed,
        questionsThisWeek,
      });

      const resend = new Resend(apiKey);
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
      const subject = `${firstName}'s SAT Tutor Update — week of ${weekOf}`;

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: `SAT Tutor Pro <${fromEmail}>`,
        to: [contact_value],
        subject,
        html,
      });

      if (emailError) throw emailError;

      return NextResponse.json({ sent: true, emailId: emailData?.id, channel: 'email' });
    }

    return NextResponse.json({ error: 'Invalid contact_type' }, { status: 400 });
  } catch (err) {
    console.error('tutor-update/send error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
