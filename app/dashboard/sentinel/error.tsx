'use client';

import { DashboardError } from '@/components/dashboard';

export default function SentinelError({
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
      title="Algorithm Sentinel Error"
      description="Failed to load algorithm monitoring data. Please try again."
    />
  );
}
