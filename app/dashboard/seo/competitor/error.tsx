'use client';

import { DashboardError } from '@/components/dashboard';

export default function SEOCompetitorError({
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
      title="SEO Competitor Error"
      description="Failed to load competitor analysis. Please try again."
    />
  );
}
