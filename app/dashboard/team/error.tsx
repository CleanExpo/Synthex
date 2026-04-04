'use client';

import { DashboardError } from '@/components/dashboard';

export default function TeamError({
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
      title="Team Error"
      description="Failed to load team data. Please try again."
    />
  );
}
