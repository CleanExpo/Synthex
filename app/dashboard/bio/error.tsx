'use client';

import { DashboardError } from '@/components/dashboard';

export default function BioError({
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
      title="Link in Bio Error"
      description="Failed to load bio pages. Please try again."
    />
  );
}
