'use client';

import { DashboardError } from '@/components/dashboard';

export default function WebProjectsError({
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
      title="Web Projects Error"
      description="Failed to load web project data. Please try again."
    />
  );
}
