'use client';

import { DashboardError } from '@/components/dashboard';

export default function PageSpeedError({
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
      title="PageSpeed Error"
      description="Failed to load PageSpeed data. Please try again."
    />
  );
}
