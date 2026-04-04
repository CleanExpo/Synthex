/**
 * Analytics Provider — SYN-489
 *
 * Wraps Vercel Analytics + Speed Insights.
 * Add this to the root layout to enable production monitoring.
 */
'use client';

import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export function AnalyticsProvider() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

export default AnalyticsProvider;
