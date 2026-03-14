'use client';

import dynamic from 'next/dynamic';

/**
 * Lazy-loaded client components for the root layout.
 *
 * These were previously imported synchronously in layout.tsx, adding
 * ~200-400 KB to every page's initial JS payload. By lazy-loading with
 * ssr: false, they download in the background after first paint.
 *
 * - PerformanceMonitor: returns null in DOM (Web Vitals only)
 * - CommandPalette: invisible until Ctrl+K
 * - ProductTour: only for new users
 * - FloatingActionButton: returns null on desktop
 * - FloatingStreak: streak counter widget
 */

const PerformanceMonitor = dynamic(
  () => import('@/components/PerformanceMonitor').then(m => ({ default: m.PerformanceMonitor })),
  { ssr: false }
);
const CommandPalette = dynamic(
  () => import('@/components/CommandPalette').then(m => ({ default: m.CommandPalette })),
  { ssr: false }
);
const ProductTour = dynamic(
  () => import('@/components/ProductTour').then(m => ({ default: m.ProductTour })),
  { ssr: false }
);
const FloatingActionButton = dynamic(
  () => import('@/components/FloatingActionButton').then(m => ({ default: m.FloatingActionButton })),
  { ssr: false }
);
const FloatingStreak = dynamic(
  () => import('@/components/StreakCounter').then(m => ({ default: m.FloatingStreak })),
  { ssr: false }
);

export function LazyClientComponents() {
  return (
    <>
      <PerformanceMonitor />
      <CommandPalette />
      <ProductTour />
      <FloatingActionButton />
      <FloatingStreak />
    </>
  );
}
