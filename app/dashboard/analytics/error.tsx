'use client';

import { DashboardError } from '@/components/dashboard';

export default function AnalyticsError({
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
      title="Analytics Error"
      description="Failed to load analytics data. Please try again."
    />
  );
}
