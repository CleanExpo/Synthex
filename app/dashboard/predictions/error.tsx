'use client';

import { DashboardError } from '@/components/dashboard';

export default function PredictionsError({
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
      title="Predictions Error"
      description="Failed to load predictions. Please try again."
    />
  );
}
