'use client';

import { DashboardError } from '@/components/dashboard';

export default function BusinessesError({
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
      title="Businesses Error"
      description="Failed to load business profiles. Please try again."
    />
  );
}
