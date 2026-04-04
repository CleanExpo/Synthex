'use client';

import { track } from '@vercel/analytics';
import { useEffect } from 'react';

interface AuthorityHubAnalyticsProps {
  clientSlug: string;
}

export function AuthorityHubAnalytics({
  clientSlug,
}: AuthorityHubAnalyticsProps) {
  useEffect(() => {
    const startTime = performance.now();
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
