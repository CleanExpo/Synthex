'use client';

import { DashboardError } from '@/components/dashboard';

export default function HelpError({
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
      title="Help Error"
      description="Failed to load help center. Please try again."
    />
  );
}
