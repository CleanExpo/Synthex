'use client';

/**
 * PerformanceSection
 *
 * Consolidates HealthScoreWidget, VisibilityScoreWidget, and AuthorityScoreCard
 * into a single labelled section. Each widget is dynamically imported and renders
 * its own loading/error states.
 */

import dynamic from 'next/dynamic';

const HealthScoreWidget = dynamic(
  () =>
    import('@/components/dashboard/HealthScoreWidget').then(m => ({
      default: m.HealthScoreWidget,
    })),
  { ssr: false }
);

const VisibilityScoreWidget = dynamic(
  () =>
    import('@/components/dashboard/VisibilityScoreWidget').then(m => ({
      default: m.VisibilityScoreWidget,
    })),
  { ssr: false }
);

const AuthorityScoreCard = dynamic(
  () =>
    import('@/components/authority/AuthorityScoreCard').then(m => ({
      default: m.AuthorityScoreCard,
    })),
  { ssr: false }
);

export function PerformanceSection() {
  return (
    <div className="space-y-3">
      <p className="text-[9px] uppercase tracking-[0.25em] text-white/40">
        Performance
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <HealthScoreWidget />
        <VisibilityScoreWidget />
        <AuthorityScoreCard />
      </div>
    </div>
  );
}
