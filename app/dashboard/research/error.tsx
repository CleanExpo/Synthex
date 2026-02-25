'use client';

import { DashboardError } from '@/components/dashboard';

export default function ResearchError({
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
      title="Research Error"
      description="Failed to load research reports. Please try again."
    />
  );
}
