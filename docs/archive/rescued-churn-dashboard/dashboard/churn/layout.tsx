/**
 * Churn Analysis Dashboard Layout
 *
 * Provides a consistent app shell with breadcrumbs.
 * Includes a page-level header with title, description, and breadcrumbs.
 */

export default function ChurnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-sx-bg-primary p-6">
      <div className="max-w-7xl mx-auto">
        <nav className="mb-4">
          <div className="text-sm text-sx-text-secondary">
            Dashboard / Churn Analysis
          </div>
        </nav>
        {children}
      </div>
    </div>
  );
}
