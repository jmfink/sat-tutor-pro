/**
 * GET /api/alerts/check?studentId=xxx
 *
 * Evaluates two alert conditions and — when RESEND_API_KEY is set — sends
 * a parent notification email via Resend.
 *
 * Conditions checked:
 *   1. Inactivity: no study session in the last 3+ days
 *   2. Regression: any sub-skill whose Elo rating is >50 points below the
 *      starting baseline of 1000 with at least 5 attempts (proxy for
 *      "has been dropping" — true historical snapshots would require a
 *      separate ratings-history table)
 *
 * Query params:
 *   studentId  (required) — UUID of the student
 *   dryRun     (optional, default false) — when "true", computes everything
 *              but skips the actual Resend API call; returns preview payload
 *
 * Always returns JSON describing what was found / sent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseServerClient } from '@/lib/supabase';
import { SUB_SKILL_MAP } from '@/lib/constants';
import type { SubSkillId } from '@/types';

const INACTIVITY_DAYS = 3;
const REGRESSION_THRESHOLD = 50; // Elo points below 1000 baseline
const MIN_ATTEMPTS_FOR_REGRESSION = 5;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function buildEmailHtml(params: {
  studentName: string;
  isInactive: boolean;
  daysSinceLastSession: number;
  lastSessionDate: string | null;
  streak: number;
  regressions: { subSkillId: string; subSkillName: string; elo: number; attempted: number }[];
  weaknesses: { subSkillId: string; subSkillName: string; elo: number; attempted: number }[];
  isTest: boolean;
}) {
  const {
    studentName, isInactive, daysSinceLastSession, lastSessionDate,
    streak, regressions, weaknesses, isTest,
  } = params;

  const alertParts: string[] = [];

  if (isTest) {
    alertParts.push(`
      <div style="background:#fef3cd;border:1px solid #ffc107;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
        <strong>⚙️ This is a test alert</strong> — sent manually from the Parent Dashboard.
      </div>`);
  }

  if (isInactive) {
    alertParts.push(`
      <div style="background:#fff8f0;border:2px solid #f97316;border-radius:8px;padding:14px 18px;margin-bottom:16px;">
        <div style="font-size:18px;margin-bottom:4px;">⚠️ Inactivity Alert</div>
        <p style="margin:0;color:#374151;">
          ${studentName} hasn't studied in <strong>${daysSinceLastSession} days</strong>.
          ${lastSessionDate ? `Last session was on <strong>${formatDate(lastSessionDate)}</strong>.` : 'No sessions recorded yet.'}
        </p>
      </div>`);
  }

  if (regressions.length > 0) {
    const regList = regressions
      .map(r => `<li><strong>${r.subSkillName}</strong> (${r.subSkillId}) — Elo: <strong>${r.elo}</strong>, ${r.attempted} attempts</li>`)
      .join('');
    alertParts.push(`
      <div style="background:#fef2f2;border:2px solid #ef4444;border-radius:8px;padding:14px 18px;margin-bottom:16px;">
        <div style="font-size:18px;margin-bottom:4px;">📉 Skill Regression Detected</div>
        <p style="margin:0 0 8px;color:#374151;">
          The following skills have dropped significantly (${REGRESSION_THRESHOLD}+ Elo points below baseline):
        </p>
        <ul style="margin:0;padding-left:20px;color:#374151;">${regList}</ul>
      </div>`);
  }

  const weaknessList = weaknesses
    .map((w, i) => `
      <tr style="background:${i % 2 === 0 ? '#f9fafb' : 'white'};">
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;">${i + 1}. ${w.subSkillName}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#6b7280;">${w.subSkillId}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#ef4444;font-weight:600;">${w.elo}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#6b7280;">${w.attempted} attempts</td>
      </tr>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>SAT Tutor Pro Alert</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937;background:#f8fafc;">
  <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#1e40af,#4338ca);padding:24px 28px;">
      <div style="color:white;font-size:22px;font-weight:900;margin-bottom:4px;">SAT Tutor Pro</div>
      <div style="color:#bfdbfe;font-size:14px;">Parent Alert — ${studentName}&apos;s progress update</div>
    </div>

    <div style="padding:24px 28px;">
      ${alertParts.join('')}

      <div style="margin-bottom:20px;">
        <div style="font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">📊 Current Status</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px 18px;flex:1;min-width:120px;">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Study Streak</div>
            <div style="font-size:28px;font-weight:900;color:#0284c7;">${streak}</div>
            <div style="font-size:11px;color:#64748b;">days</div>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 18px;flex:1;min-width:120px;">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Last Session</div>
            <div style="font-size:13px;font-weight:700;color:#15803d;margin-top:4px;">
              ${lastSessionDate ? formatDate(lastSessionDate) : 'None yet'}
            </div>
          </div>
        </div>
      </div>

      ${weaknesses.length > 0 ? `
      <div>
        <div style="font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">🎯 Top 3 Areas Needing Work</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;color:#475569;">Skill</th>
              <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;color:#475569;">ID</th>
              <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;color:#475569;">Elo</th>
              <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;color:#475569;">Attempts</th>
            </tr>
          </thead>
          <tbody>${weaknessList}</tbody>
        </table>
      </div>` : ''}

      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#94a3b8;text-align:center;">
        SAT Tutor Pro · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/parent" style="color:#3b82f6;">View Parent Dashboard</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  const dryRun = searchParams.get('dryRun') === 'true';
  const isTest = searchParams.get('test') === 'true';

  if (!studentId) {
    return NextResponse.json({ error: 'studentId required' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  // Fetch all data in parallel
  const [
    { data: student },
    { data: sessions },
    { data: skillRatings },
    { data: dailyActivity },
  ] = await Promise.all([
    supabase.from('students').select('name, parent_email').eq('id', studentId).single(),
    supabase.from('sessions').select('started_at, ended_at, session_type').eq('student_id', studentId).order('started_at', { ascending: false }).limit(10),
    supabase.from('skill_ratings').select('sub_skill_id, elo_rating, questions_attempted').eq('student_id', studentId),
    supabase.from('daily_activity').select('activity_date, streak_qualifying').eq('student_id', studentId).order('activity_date', { ascending: false }).limit(60),
  ]);

  // ── Inactivity check ──────────────────────────────────────────────────────
  const lastSession = sessions?.[0] ?? null;
  const lastSessionDate = lastSession?.started_at ?? null;
  const daysSinceLastSession = lastSessionDate
    ? Math.floor((Date.now() - new Date(lastSessionDate).getTime()) / 86_400_000)
    : 999;
  const isInactive = daysSinceLastSession >= INACTIVITY_DAYS;

  // ── Regression check ─────────────────────────────────────────────────────
  // Proxy: sub-skills >= MIN_ATTEMPTS where elo < (1000 - REGRESSION_THRESHOLD)
  const regressions = (skillRatings ?? [])
    .filter(r => r.questions_attempted >= MIN_ATTEMPTS_FOR_REGRESSION && r.elo_rating < (1000 - REGRESSION_THRESHOLD))
    .map(r => ({
      subSkillId: r.sub_skill_id,
      subSkillName: SUB_SKILL_MAP[r.sub_skill_id as SubSkillId]?.name ?? r.sub_skill_id,
      elo: r.elo_rating,
      attempted: r.questions_attempted,
    }))
    .sort((a, b) => a.elo - b.elo)
    .slice(0, 5);

  // ── Top 3 weaknesses (lowest elo, must have attempts) ────────────────────
  const weaknesses = (skillRatings ?? [])
    .filter(r => r.questions_attempted > 0)
    .sort((a, b) => a.elo_rating - b.elo_rating)
    .slice(0, 3)
    .map(r => ({
      subSkillId: r.sub_skill_id,
      subSkillName: SUB_SKILL_MAP[r.sub_skill_id as SubSkillId]?.name ?? r.sub_skill_id,
      elo: r.elo_rating,
      attempted: r.questions_attempted,
    }));

  // ── Streak (consecutive qualifying days from today) ───────────────────────
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activityDates = new Set(
    (dailyActivity ?? [])
      .filter(d => d.streak_qualifying)
      .map(d => d.activity_date)
  );
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split('T')[0];
    if (activityDates.has(key)) {
      streak++;
    } else if (i > 0) {
      break; // gap found
    }
  }

  const shouldSend = isTest || isInactive || regressions.length > 0;
  const parentEmail = student?.parent_email ?? null;
  const studentName = student?.name ?? (process.env.NEXT_PUBLIC_STUDENT_NAME ?? 'Student');

  const alertSubject = isTest
    ? `[Test] SAT Tutor Pro — Alert check for ${studentName}`
    : isInactive && regressions.length > 0
    ? `⚠️ ${studentName} hasn't studied in ${daysSinceLastSession} days + skill regression detected`
    : isInactive
    ? `⚠️ ${studentName} hasn't studied in ${daysSinceLastSession} days`
    : `📉 Skill regression detected for ${studentName}`;

  const emailHtml = buildEmailHtml({
    studentName,
    isInactive: isTest ? false : isInactive,
    daysSinceLastSession,
    lastSessionDate,
    streak,
    regressions: isTest ? [] : regressions,
    weaknesses,
    isTest,
  });

  // ── Early return for dry run or nothing to send ───────────────────────────
  if (dryRun || (!shouldSend && !isTest)) {
    return NextResponse.json({
      sent: false,
      dryRun,
      reason: isTest ? 'test' : isInactive && regressions.length > 0 ? 'both' : isInactive ? 'inactivity' : regressions.length > 0 ? 'regression' : 'none',
      isInactive,
      daysSinceLastSession,
      lastSessionDate,
      streak,
      regressions,
      weaknesses,
      parentEmail,
      preview: { subject: alertSubject, bodyHtml: emailHtml },
    });
  }

  // ── Send via Resend ───────────────────────────────────────────────────────
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.startsWith('re_placeholder')) {
    return NextResponse.json({
      sent: false,
      error: 'RESEND_API_KEY not configured. Add a real key to .env.local.',
      reason: isInactive && regressions.length > 0 ? 'both' : isInactive ? 'inactivity' : regressions.length > 0 ? 'regression' : 'test',
      parentEmail,
      isInactive,
      daysSinceLastSession,
      regressions,
      weaknesses,
      streak,
    });
  }

  if (!parentEmail) {
    return NextResponse.json({
      sent: false,
      error: 'No parent email configured. Add one in Settings.',
      parentEmail: null,
    });
  }

  try {
    const resend = new Resend(apiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `SAT Tutor Pro <${fromEmail}>`,
      to: [parentEmail],
      subject: alertSubject,
      html: emailHtml,
    });

    if (emailError) throw emailError;

    return NextResponse.json({
      sent: true,
      emailId: emailData?.id,
      to: parentEmail,
      subject: alertSubject,
      reason: isTest ? 'test' : isInactive && regressions.length > 0 ? 'both' : isInactive ? 'inactivity' : 'regression',
      isInactive,
      daysSinceLastSession,
      regressions,
      weaknesses,
      streak,
    });
  } catch (err) {
    return NextResponse.json({ sent: false, error: String(err) }, { status: 500 });
  }
}
