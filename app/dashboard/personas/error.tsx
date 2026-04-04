'use client';

import { DashboardError } from '@/components/dashboard';

export default function PersonasError({
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
      title="Personas Error"
      description="Failed to load personas. Please try again."
    />
  );
}
