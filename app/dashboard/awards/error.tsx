'use client';

import { DashboardError } from '@/components/dashboard';

export default function AwardsError({
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
      title="Awards & Directories Error"
      description="Failed to load awards and directory data. Please try again."
    />
  );
}
