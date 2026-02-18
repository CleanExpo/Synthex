/**
 * AI Chat Error Boundary
 *
 * @description Error fallback for AI Chat page.
 */

'use client';

import { DashboardError } from '@/components/dashboard/error-fallback';

export default function AIChatError({
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
      title="AI Chat Error"
      description="Failed to load the AI Chat Assistant. Please try again."
    />
  );
}
