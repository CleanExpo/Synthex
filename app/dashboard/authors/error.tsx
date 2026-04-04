'use client';

import { DashboardError } from '@/components/dashboard';

export default function AuthorsError({
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
      title="Authors Error"
      description="Failed to load author profiles. Please try again."
    />
  );
}
