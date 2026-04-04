'use client';

import { DashboardError } from '@/components/dashboard';

export default function ScheduledAuditsError({
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
      title="Scheduled Audits Error"
      description="Failed to load scheduled audits. Please try again."
    />
  );
}
