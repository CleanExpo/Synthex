'use client';

import { DashboardError } from '@/components/dashboard/error-fallback';

/**
 * Workflows page error boundary — shown when the page throws an unhandled error.
 */
export default function WorkflowsError({
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
      title="Workflow Error"
      description="Failed to load workflows. Please try again."
    />
  );
}
