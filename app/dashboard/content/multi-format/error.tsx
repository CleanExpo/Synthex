'use client';

import { DashboardError } from '@/components/dashboard/error-fallback';

export default function MultiFormatError({
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
      title="Multi-format Generator Error"
      description="Failed to load the multi-format generator."
    />
  );
}
