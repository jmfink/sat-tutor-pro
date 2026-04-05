// Minimal layout for public tutor report pages — no nav, no sidebar, no app shell.
// AppShell in the root layout also excludes /report/ paths, so no chrome renders.
export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
