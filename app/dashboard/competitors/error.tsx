'use client';

import { DashboardError } from '@/components/dashboard';

export default function CompetitorsError({
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
      title="Competitors Error"
      description="Failed to load competitor data. Please try again."
    />
  );
}
