'use client';

import { DashboardError } from '@/components/dashboard';

export default function ApprovalsError({
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
      title="Approvals Error"
      description="Failed to load approval workflows. Please try again."
    />
  );
}
