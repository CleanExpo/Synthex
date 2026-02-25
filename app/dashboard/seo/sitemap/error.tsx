'use client';

import { DashboardError } from '@/components/dashboard';

export default function SitemapError({
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
      title="Sitemap Error"
      description="Failed to load sitemap manager. Please try again."
    />
  );
}
