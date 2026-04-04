'use client';

import { DashboardError } from '@/components/dashboard';

export default function GEOError({
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
      title="GEO Analysis Error"
      description="Failed to load GEO analysis. Please try again."
    />
  );
}
