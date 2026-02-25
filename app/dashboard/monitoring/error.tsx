'use client';

import { DashboardError } from '@/components/dashboard';

export default function MonitoringError({
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
      title="Monitoring Error"
      description="Failed to load system monitoring. Please try again."
    />
  );
}
