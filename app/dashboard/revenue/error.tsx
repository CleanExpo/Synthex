'use client';

import { DashboardError } from '@/components/dashboard';

export default function RevenueError({
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
      title="Revenue Error"
      description="Failed to load revenue data. Please try again."
    />
  );
}
