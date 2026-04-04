'use client';

import { DashboardError } from '@/components/dashboard';

export default function SponsorsError({
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
      title="Sponsors Error"
      description="Failed to load sponsor data. Please try again."
    />
  );
}
