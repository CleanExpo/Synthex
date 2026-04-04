'use client';

import { DashboardError } from '@/components/dashboard';

export default function BrandProfileError({
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
      title="Brand Profile Error"
      description="Failed to load brand profile settings. Please try again."
    />
  );
}
