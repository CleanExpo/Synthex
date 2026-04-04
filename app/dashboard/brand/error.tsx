'use client';

import { DashboardError } from '@/components/dashboard';

export default function BrandError({
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
      title="Brand Builder Error"
      description="Failed to load brand identity data. Please try again."
    />
  );
}
