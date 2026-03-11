'use client';

import { DashboardError } from '@/components/dashboard';

export default function BOHealthError({
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
      title="BO Health Error"
      description="Failed to load Bayesian optimisation health data. Please try again."
    />
  );
}
