'use client';

import { DashboardError } from '@/components/dashboard';

export default function VisualsError({
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
      title="Visuals Error"
      description="Failed to load visual assets. Please try again."
    />
  );
}
