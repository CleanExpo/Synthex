'use client';

import { DashboardError } from '@/components/dashboard';

export default function BenchmarksError({
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
      title="Benchmarks Error"
      description="Failed to load benchmark data. Please try again."
    />
  );
}
