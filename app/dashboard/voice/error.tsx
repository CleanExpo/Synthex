'use client';

import { DashboardError } from '@/components/dashboard';

export default function VoiceError({
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
      title="Voice Dashboard Error"
      description="Failed to load voice analysis data. Please try again."
    />
  );
}
