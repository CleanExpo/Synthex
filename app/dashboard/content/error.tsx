'use client';

import { DashboardError } from '@/components/dashboard';

export default function ContentError({
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
      title="Content Error"
      description="Failed to load content generator. Please try again."
    />
  );
}
