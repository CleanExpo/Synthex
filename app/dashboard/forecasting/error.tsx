'use client';

import { DashboardError } from '@/components/dashboard';

export default function ForecastingError({
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
      title="Forecasting Error"
      description="Failed to load forecasting data. Please try again."
    />
  );
}
