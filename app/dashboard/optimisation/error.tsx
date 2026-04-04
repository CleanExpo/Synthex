'use client';

import { DashboardError } from '@/components/dashboard';

export default function OptimisationError({
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
      title="Optimisation Error"
      description="Failed to load optimisation surfaces. Please try again."
    />
  );
}
