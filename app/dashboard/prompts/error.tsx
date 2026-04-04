'use client';

import { DashboardError } from '@/components/dashboard';

export default function PromptsError({
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
      title="Prompt Intelligence Error"
      description="Failed to load prompt tracking data. Please try again."
    />
  );
}
