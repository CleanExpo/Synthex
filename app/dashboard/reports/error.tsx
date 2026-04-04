'use client';

import { DashboardError } from '@/components/dashboard';

export default function ReportsError({
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
      title="Reports Error"
      description="Failed to load reports. Please try again."
    />
  );
}
