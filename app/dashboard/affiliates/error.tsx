'use client';

import { DashboardError } from '@/components/dashboard';

export default function AffiliatesError({
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
      title="Affiliates Error"
      description="Failed to load affiliate data. Please try again."
    />
  );
}
