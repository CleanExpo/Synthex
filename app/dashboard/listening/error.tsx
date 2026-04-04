'use client';

import { DashboardError } from '@/components/dashboard';

export default function ListeningError({
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
      title="Social Listening Error"
      description="Failed to load social listening data. Please try again."
    />
  );
}
