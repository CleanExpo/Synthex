'use client';

import { DashboardError } from '@/components/dashboard';

export default function SandboxError({
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
      title="Sandbox Error"
      description="Failed to load sandbox. Please try again."
    />
  );
}
