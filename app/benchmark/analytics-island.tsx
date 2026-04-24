'use client';

/**
 * GA4 analytics island — SYN-779
 *
 * Fires `benchmark_page_view` on mount and exposes a click handler on
 * the trial CTA via a global `window.__synthexTrackBenchmarkCta`
 * (picked up by server-rendered <a>s). The island is intentionally tiny:
 * no state, no rendering, no network other than the dataLayer push.
 */

import { useEffect } from 'react';

interface GtagWindow extends Window {
  dataLayer?: Array<Record<string, unknown>>;
  __synthexTrackBenchmarkCta?: () => void;
}

function push(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  const w = window as GtagWindow;
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event, ...params });
}

export function BenchmarkAnalyticsIsland(): null {
  useEffect(() => {
    push('benchmark_page_view', {
      page_path: '/benchmark',
      page_location:
        typeof window !== 'undefined' ? window.location.href : undefined,
    });

    const w = window as GtagWindow;
    w.__synthexTrackBenchmarkCta = () => {
      push('benchmark_trial_cta_click', { page_path: '/benchmark' });
    };

    return () => {
      const cleanup = window as GtagWindow;
      if (cleanup.__synthexTrackBenchmarkCta) {
        delete cleanup.__synthexTrackBenchmarkCta;
      }
    };
  }, []);

  return null;
}

export function BenchmarkCtaLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        const w = window as GtagWindow;
        w.__synthexTrackBenchmarkCta?.();
      }}
    >
      {children}
    </a>
  );
}
