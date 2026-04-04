'use client';

import { DashboardError } from '@/components/dashboard';

export default function DashboardRootError({
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
      title="Dashboard Error"
      description="An error occurred while loading the dashboard. Please try again."
    />
  );
}
