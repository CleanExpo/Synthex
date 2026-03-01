'use client';

import { DashboardError } from '@/components/dashboard';

export default function PlatformsError({
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
      title="Platforms Error"
      description="Failed to load platform connections. Please try again."
    />
  );
}
