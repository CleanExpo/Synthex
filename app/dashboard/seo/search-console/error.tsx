'use client';

import { DashboardError } from '@/components/dashboard';

export default function SearchConsoleError({
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
      title="Search Console Error"
      description="Failed to load Search Console data. Please try again."
    />
  );
}
