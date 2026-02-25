'use client';

import { DashboardError } from '@/components/dashboard';

export default function AdminError({
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
      title="Admin Error"
      description="Failed to load admin panel. Please try again."
    />
  );
}
