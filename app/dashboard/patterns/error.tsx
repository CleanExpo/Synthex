'use client';

import { DashboardError } from '@/components/dashboard';

export default function PatternsError({
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
      title="Patterns Error"
      description="Failed to load psychology patterns. Please try again."
    />
  );
}
