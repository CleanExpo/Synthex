'use client';

import { DashboardError } from '@/components/dashboard';

export default function BacklinksError({
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
      title="Backlink Prospector Error"
      description="Failed to load backlink prospecting data. Please try again."
    />
  );
}
