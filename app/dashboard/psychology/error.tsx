'use client';

import { DashboardError } from '@/components/dashboard';

export default function PsychologyError({
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
      title="Psychology Error"
      description="Failed to load psychology insights. Please try again."
    />
  );
}
