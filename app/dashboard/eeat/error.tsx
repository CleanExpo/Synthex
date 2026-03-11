'use client';

import { DashboardError } from '@/components/dashboard';

export default function EEATError({
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
      title="E-E-A-T Builder Error"
      description="Failed to load E-E-A-T scoring data. Please try again."
    />
  );
}
