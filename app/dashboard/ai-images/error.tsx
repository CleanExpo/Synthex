/**
 * AI Images Error Boundary
 *
 * @description Error fallback for AI Images page.
 */

'use client';

import { DashboardError } from '@/components/dashboard/error-fallback';

export default function AIImagesError({
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
      title="AI Images Error"
      description="Failed to load AI Image Generation. Please try again."
    />
  );
}
