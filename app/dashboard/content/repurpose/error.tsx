'use client';

/**
 * Error boundary for Content Repurposer page
 */

import { DashboardError } from '@/components/dashboard/error-fallback';

export default function RepurposeError({
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
      title="Content Repurposer Error"
      description="An error occurred while loading the Content Repurposer."
    />
  );
}
