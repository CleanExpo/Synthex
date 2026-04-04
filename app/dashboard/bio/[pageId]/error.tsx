'use client';

import { DashboardError } from '@/components/dashboard';

export default function BioPageError({
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
      title="Bio Page Error"
      description="Failed to load this bio page. Please try again."
    />
  );
}
