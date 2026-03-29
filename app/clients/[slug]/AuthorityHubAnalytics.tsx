'use client';

import { useEffect } from 'react';
import { track } from '@vercel/analytics';

interface AuthorityHubAnalyticsProps {
  clientSlug: string;
}

export default function AuthorityHubAnalytics({ clientSlug }: AuthorityHubAnalyticsProps) {
  useEffect(() => {
    const startTime = performance.now();

    // Fire after first paint commit — requestAnimationFrame guarantees browser
    // has committed to painting before we capture the timing.
    requestAnimationFrame(() => {
      const loadTimeMs = Math.round(performance.now() - startTime);
      track('authority_hub_first_paint', {
        client_slug: clientSlug,
        load_time_ms: loadTimeMs,
      });
    });
  }, [clientSlug]);

  return null;
}
