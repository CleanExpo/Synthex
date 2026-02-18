'use client';

/**
 * Error boundary for Cross-Post page
 */

import { DashboardError } from '@/components/dashboard/error-fallback';

export default function CrossPostError({
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
      title="Cross-Post Error"
      description="An error occurred while loading the Cross-Post page."
    />
  );
}
