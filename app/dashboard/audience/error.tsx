'use client';

import { DashboardError } from '@/components/dashboard';

export default function AudienceError({
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
      title="Audience Error"
      description="Failed to load audience insights. Please try again."
    />
  );
}
