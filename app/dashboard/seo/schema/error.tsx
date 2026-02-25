'use client';

import { DashboardError } from '@/components/dashboard';

export default function SchemaError({
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
      title="Schema Error"
      description="Failed to load schema markup editor. Please try again."
    />
  );
}
