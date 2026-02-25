'use client';

import { DashboardError } from '@/components/dashboard';

export default function VideoError({
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
      title="Video Error"
      description="Failed to load video tools. Please try again."
    />
  );
}
