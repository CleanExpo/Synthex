'use client';

import { DashboardError } from '@/components/dashboard';

export default function ROIError({
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
      title="ROI Calculator Error"
      description="Failed to load ROI calculator. Please try again."
    />
  );
}
