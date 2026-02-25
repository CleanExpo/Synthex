'use client';

import { DashboardError } from '@/components/dashboard';

export default function GEOReadinessError({
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
      title="GEO Readiness Error"
      description="Failed to load GEO readiness data. Please try again."
    />
  );
}
