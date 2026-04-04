'use client';

import { DashboardError } from '@/components/dashboard';

export default function QualityError({
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
      title="Content Quality Error"
      description="Failed to load content quality data. Please try again."
    />
  );
}
