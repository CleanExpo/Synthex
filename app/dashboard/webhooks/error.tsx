'use client';

import { DashboardError } from '@/components/dashboard';

export default function WebhooksError({
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
      title="Webhooks Error"
      description="Failed to load webhook configuration. Please try again."
    />
  );
}
