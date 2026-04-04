'use client';

import { DashboardError } from '@/components/dashboard';

export default function TasksError({
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
      title="Tasks Error"
      description="Failed to load tasks. Please try again."
    />
  );
}
