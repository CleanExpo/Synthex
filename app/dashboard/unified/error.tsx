'use client';

import { DashboardError } from '@/components/dashboard';

export default function UnifiedError({
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
      title="Unified Dashboard Error"
      description="Failed to load unified dashboard. Please try again."
    />
  );
}
