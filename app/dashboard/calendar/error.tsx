'use client';

import { DashboardError } from '@/components/dashboard';

export default function CalendarError({
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
      title="Calendar Error"
      description="Failed to load calendar. Please try again."
    />
  );
}
