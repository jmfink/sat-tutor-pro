import type { Metadata } from 'next';
import { fetchTutorReport } from '@/lib/tutor-report';
import { TutorUpdateReport } from '@/components/tutor-update-report';

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const result = await fetchTutorReport(token);
  if (result.status !== 200) {
    return { title: 'SAT Tutor Update', robots: { index: false } };
  }
  return {
    title: `${result.data.student_first_name}'s SAT Tutor Update`,
    robots: { index: false, follow: false },
  };
}

export default async function TutorReportPage({ params }: Props) {
  const { token } = await params;
  const result = await fetchTutorReport(token);

  if (result.status === 404) {
    return (
      <div style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '420px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔍</div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1E3A5F', margin: '0 0 8px' }}>
            Report not found
          </h1>
          <p style={{ color: '#64748b', fontSize: '15px', margin: 0 }}>
            This report link is invalid. Ask your student to share a new link.
          </p>
        </div>
      </div>
    );
  }

  if (result.status === 410) {
    return (
      <div style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '420px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏰</div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1E3A5F', margin: '0 0 8px' }}>
            This report has expired
          </h1>
          <p style={{ color: '#64748b', fontSize: '15px', margin: 0 }}>
            Ask your student to share a new link from SAT Tutor Pro.
          </p>
        </div>
      </div>
    );
  }

  return <TutorUpdateReport data={result.data} />;
}
