'use client';

import { DashboardError } from '@/components/dashboard';

export default function ChatError({
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
      title="Chat Error"
      description="Failed to load conversation data. Please try again."
    />
  );
}
