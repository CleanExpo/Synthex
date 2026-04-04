'use client';

import { DashboardError } from '@/components/dashboard';

export default function TechnicalSEOError({
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
      title="Technical SEO Error"
      description="Failed to load technical SEO data. Please try again."
    />
  );
}
