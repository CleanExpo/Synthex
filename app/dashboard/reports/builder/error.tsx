'use client';

import { DashboardError } from '@/components/dashboard';

export default function ReportBuilderError({
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
      title="Report Builder Error"
      description="Failed to load the report builder. Please try again."
    />
  );
}
