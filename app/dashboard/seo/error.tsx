'use client';

import { DashboardError } from '@/components/dashboard';

export default function SeoError({
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
      title="SEO Dashboard Error"
      description="Failed to load SEO data. Please try again."
    />
  );
}
