'use client';

import { DashboardError } from '@/components/dashboard';

export default function CitationError({
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
      title="Citation Dashboard Error"
      description="Failed to load citation performance data. Please try again."
    />
  );
}
