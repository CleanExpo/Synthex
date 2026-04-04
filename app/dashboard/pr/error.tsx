'use client';

import { DashboardError } from '@/components/dashboard';

export default function PRError({
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
      title="PR Manager Error"
      description="Failed to load PR and media data. Please try again."
    />
  );
}
