'use client';

import { DashboardError } from '@/components/dashboard';

export default function BackupsError({
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
      title="Backups Error"
      description="Failed to load backup manager. Please try again."
    />
  );
}
