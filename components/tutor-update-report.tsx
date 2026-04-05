import type { TutorReportData } from '@/lib/tutor-report';

interface Props {
  data: TutorReportData;
}

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <span style={{ color: '#059669' }}>↑</span>;
  if (trend === 'down') return <span style={{ color: '#DC2626' }}>↓</span>;
  return <span style={{ color: '#94a3b8' }}>→</span>;
}

function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{
      background: '#e2e8f0',
      borderRadius: '9999px',
      height: '8px',
      width: '100%',
      overflow: 'hidden',
    }}>
      <div style={{
        background: '#059669',
        width: `${pct}%`,
        height: '100%',
        borderRadius: '9999px',
        transition: 'width 0.3s ease',
      }} />
    </div>
  );
}

export function TutorUpdateReport({ data }: Props) {
  const {
    student_first_name,
    week_of,
    predicted_score,
    score_delta_4w,
    rw_score,
    math_score,
    days_practiced,
    questions_this_week,
    weak_skills,
    trending_up,
    top_insight,
  } = data;

  const scoreDeltaLabel =
    score_delta_4w === null
      ? null
      : score_delta_4w > 0
      ? `+${score_delta_4w} vs 4 weeks ago`
      : score_delta_4w < 0
      ? `${score_delta_4w} vs 4 weeks ago`
      : 'No change vs 4 weeks ago';

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      background: '#f8fafc',
      minHeight: '100vh',
      padding: '0',
      margin: '0',
      color: '#1f2937',
    }}>
      {/* Page wrapper */}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px 48px' }}>

        {/* Attribution block — at the very top, before student data */}
        <div style={{
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
        }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>
            This report was created by{' '}
            <a href={process.env.NEXT_PUBLIC_APP_URL ?? 'https://sat-tutor-pro.vercel.app'} style={{ color: '#2563EB', textDecoration: 'none' }}>
              SAT Tutor Pro
            </a>
            , an AI-powered SAT practice app <strong>{student_first_name}</strong> uses between sessions.
            {' '}It identifies error patterns and skill gaps automatically — no setup needed on your end.
          </p>
        </div>

        {/* Report header */}
        <div style={{
          background: '#1E3A5F',
          borderRadius: '12px',
          padding: '24px 28px',
          marginBottom: '20px',
          color: 'white',
        }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 900 }}>
            {student_first_name}&apos;s SAT Tutor Update
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#93c5fd' }}>
            Week of {week_of}
          </p>

          {/* Score row */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{
              background: 'rgba(255,255,255,0.12)',
              borderRadius: '10px',
              padding: '14px 20px',
              flex: '1',
              minWidth: '120px',
            }}>
              <div style={{ fontSize: '11px', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Predicted Score
              </div>
              <div style={{ fontSize: '32px', fontWeight: 900 }}>
                {predicted_score ?? '—'}
              </div>
              {scoreDeltaLabel && (
                <div style={{ fontSize: '12px', color: '#86efac', marginTop: '2px' }}>
                  {scoreDeltaLabel}
                </div>
              )}
              <div style={{ fontSize: '11px', color: '#93c5fd', marginTop: '2px' }}>out of 1600</div>
            </div>

            {rw_score && (
              <div style={{
                background: 'rgba(255,255,255,0.12)',
                borderRadius: '10px',
                padding: '14px 20px',
                flex: '1',
                minWidth: '120px',
              }}>
                <div style={{ fontSize: '11px', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Reading & Writing
                </div>
                <div style={{ fontSize: '32px', fontWeight: 900 }}>{rw_score}</div>
                <div style={{ fontSize: '11px', color: '#93c5fd', marginTop: '2px' }}>out of 800</div>
              </div>
            )}

            {math_score && (
              <div style={{
                background: 'rgba(255,255,255,0.12)',
                borderRadius: '10px',
                padding: '14px 20px',
                flex: '1',
                minWidth: '120px',
              }}>
                <div style={{ fontSize: '11px', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Math
                </div>
                <div style={{ fontSize: '32px', fontWeight: 900 }}>{math_score}</div>
                <div style={{ fontSize: '11px', color: '#93c5fd', marginTop: '2px' }}>out of 800</div>
              </div>
            )}
          </div>
        </div>

        {/* Practice this week */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '20px 24px',
          marginBottom: '16px',
        }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Practice This Week
          </h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              padding: '16px 20px',
              flex: '1',
              minWidth: '120px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Days Practiced</div>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#059669' }}>{days_practiced}<span style={{ fontSize: '18px', fontWeight: 500, color: '#94a3b8' }}>/7</span></div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>this week</div>
            </div>
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              padding: '16px 20px',
              flex: '1',
              minWidth: '120px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Questions Answered</div>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#059669' }}>{questions_this_week}</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>this week</div>
            </div>
          </div>
        </div>

        {/* Focus for your next session */}
        {weak_skills.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '20px 24px',
            marginBottom: '16px',
          }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Focus for Your Next Session
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#94a3b8' }}>
              Skills with the lowest accuracy that need targeted work
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {weak_skills.map((skill, i) => (
                <div key={skill.sub_skill_id} style={{
                  background: '#fafafa',
                  border: '1px solid #f1f5f9',
                  borderRadius: '8px',
                  padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#94a3b8', marginRight: '8px' }}>#{i + 1}</span>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#1f2937' }}>{skill.name}</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}>{skill.sub_skill_id}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: '16px', color: skill.accuracy < 50 ? '#DC2626' : skill.accuracy < 70 ? '#d97706' : '#1f2937' }}>
                        {skill.accuracy}%
                      </span>
                      <TrendArrow trend={skill.trend} />
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                    {skill.pattern_note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pattern the AI flagged */}
        {top_insight && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            borderLeft: '4px solid #F59E0B',
            padding: '20px 24px',
            marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '16px' }}>🧠</span>
              <h2 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Wrong Answer Intelligence
              </h2>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: '15px', color: '#1f2937', lineHeight: '1.6', fontWeight: 500 }}>
              {top_insight.finding}
            </p>
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '12px 16px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Suggested focus for your session
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#78350f', lineHeight: '1.6' }}>
                {top_insight.recommendation}
              </p>
            </div>
          </div>
        )}

        {/* Making progress */}
        {trending_up.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '20px 24px',
            marginBottom: '16px',
          }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Making Progress
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#94a3b8' }}>
              Skills with the most improvement recently
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {trending_up.map((skill) => (
                <div key={skill.sub_skill_id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: '#1f2937' }}>{skill.name}</span>
                    <span style={{ fontSize: '13px', color: '#059669', fontWeight: 700 }}>
                      {skill.accuracy_before}% → {skill.accuracy_after}%{' '}
                      <span style={{ fontSize: '11px', color: '#86efac' }}>(+{skill.delta}%)</span>
                    </span>
                  </div>
                  <ProgressBar value={skill.accuracy_after} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '24px 0 0', borderTop: '1px solid #e2e8f0', marginTop: '8px' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
            Generated by{' '}
            <a href={process.env.NEXT_PUBLIC_APP_URL ?? 'https://sat-tutor-pro.vercel.app'} style={{ color: '#94a3b8', textDecoration: 'none' }}>
              SAT Tutor Pro
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
