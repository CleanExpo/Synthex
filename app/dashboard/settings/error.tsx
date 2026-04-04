'use client';

import { DashboardError } from '@/components/dashboard';

export default function SettingsError({
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
      title="Settings Error"
      description="Failed to load settings. Please try again."
    />
  );
}
