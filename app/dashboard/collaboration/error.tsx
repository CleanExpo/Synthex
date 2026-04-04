'use client';

import { DashboardError } from '@/components/dashboard';

export default function CollaborationError({
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
      title="Collaboration Error"
      description="Failed to load collaboration tools. Please try again."
    />
  );
}
