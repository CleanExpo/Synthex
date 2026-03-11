'use client';

import { DashboardError } from '@/components/dashboard';

export default function InsightsError({
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
      title="Insights Error"
      description="Failed to load AI insights data. Please try again."
    />
  );
}
