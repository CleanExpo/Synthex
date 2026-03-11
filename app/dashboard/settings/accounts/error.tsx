'use client';

import { DashboardError } from '@/components/dashboard';

export default function ConnectedAccountsError({
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
      title="Connected Accounts Error"
      description="Failed to load connected accounts. Please try again."
    />
  );
}
