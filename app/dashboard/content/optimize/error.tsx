'use client';

import { DashboardError } from '@/components/dashboard/error-fallback';

export default function ContentOptimizeError({
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
      title="Content Optimizer Error"
      description="Failed to load the content optimizer. Please try again."
    />
  );
}
