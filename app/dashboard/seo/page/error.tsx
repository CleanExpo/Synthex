'use client';

import { DashboardError } from '@/components/dashboard';

export default function SEOPageError({
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
      title="Page Analysis Error"
      description="Failed to load page analysis. Please try again."
    />
  );
}
