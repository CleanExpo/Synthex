'use client';

import { APIErrorCard } from '@/components/error-states/api-error';

export default function QueueError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6">
      <APIErrorCard error={error} onRetry={reset} showDetails />
    </div>
  );
}
