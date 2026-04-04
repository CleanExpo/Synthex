'use client';

import { DashboardError } from '@/components/dashboard';

export default function ProjectDetailError({
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
      title="Project Detail Error"
      description="Failed to load project details. Please try again."
    />
  );
}
