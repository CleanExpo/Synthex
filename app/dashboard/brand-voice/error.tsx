'use client';

import { DashboardError } from '@/components/dashboard';

export default function BrandVoiceError({
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
      title="Brand Voice Error"
      description="Failed to load brand voice data. Please try again."
    />
  );
}
