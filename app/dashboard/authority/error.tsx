'use client';

import { DashboardError } from '@/components/dashboard';

export default function AuthorityError({
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
      title="Authority Engine Error"
      description="Failed to load authority analysis data. Please try again."
    />
  );
}
