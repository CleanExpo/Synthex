'use client';

import { DashboardError } from '@/components/dashboard';

export default function GEOOptimiserError({
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
      title="GEO Optimiser Error"
      description="Failed to load GEO optimisation data. Please try again."
    />
  );
}
