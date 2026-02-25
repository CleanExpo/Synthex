'use client';

import { DashboardError } from '@/components/dashboard';

export default function ContentPerformanceError({
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
      title="Content Performance Error"
      description="Failed to load content performance data. Please try again."
    />
  );
}
