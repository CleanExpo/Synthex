'use client';

import { DashboardError } from '@/components/dashboard';

export default function IntegrationsError({
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
      title="Integrations Error"
      description="Failed to load integrations. Please try again."
    />
  );
}
