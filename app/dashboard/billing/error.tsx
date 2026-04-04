'use client';

import { DashboardError } from '@/components/dashboard';

export default function BillingError({
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
      title="Billing Error"
      description="Failed to load billing information. Please try again."
    />
  );
}
