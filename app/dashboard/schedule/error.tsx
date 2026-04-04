'use client';

import { DashboardError } from '@/components/dashboard';

export default function ScheduleError({
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
      title="Schedule Error"
      description="Failed to load content calendar. Please try again."
    />
  );
}
