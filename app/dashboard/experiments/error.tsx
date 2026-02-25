'use client';

import { DashboardError } from '@/components/dashboard';

export default function ExperimentsError({
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
      title="Experiments Error"
      description="Failed to load A/B experiments. Please try again."
    />
  );
}
