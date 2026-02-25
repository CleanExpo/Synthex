'use client';

import { DashboardError } from '@/components/dashboard';

export default function RolesError({
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
      title="Roles Error"
      description="Failed to load role settings. Please try again."
    />
  );
}
