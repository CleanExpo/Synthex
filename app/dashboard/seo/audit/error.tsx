'use client';

import { DashboardError } from '@/components/dashboard';

export default function SEOAuditError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <DashboardError
      error={error}
      reset={reset}
      title="SEO Audit Error"
      description="Failed to load SEO audit. Please try again."
    />
  );
}
