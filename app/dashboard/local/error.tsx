'use client';

import { DashboardError } from '@/components/dashboard';

export default function LocalError({
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
      title="Local SEO Error"
      description="Failed to load local SEO data. Please try again."
    />
  );
}
