/**
 * Generation Insights Panel
 *
 * @description Small card summarising the caller's batch-feedback history —
 * raw counts always, rate stats only once there is enough signal. Plain
 * `fetch` on mount + `refreshKey` change — deliberately NOT SWR, since
 * org-scoped SWR keying is unavailable client-side here (spec 2026-07-12
 * Part E deviation ledger entry).
 */

'use client';

import { useEffect, useState } from 'react';
import { MIN_SAMPLE_FOR_RATES } from '@/lib/services/ai/image-feedback-core';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface InsightsData {
  totalBatchesRanked: number;
  totalKept: number;
  totalRejected: number;
  sampleSize: number;
  groundedWinRate: number | null;
  groundedShare: number | null;
  styleWinRates: Array<{ style: string; rank1Count: number }>;
  topReferenceSets: Array<{ referenceSet: string; keptCount: number }>;
  providerAvgRank: Array<{ provider: string; avgRank: number; n: number }>;
}

interface GenerationInsightsProps {
  /** Bump this after each successful feedback save to trigger a refetch. */
  refreshKey?: number;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function GenerationInsights({
  refreshKey,
  className,
}: GenerationInsightsProps) {
  const [data, setData] = useState<InsightsData | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/media/generate/image/feedback', { credentials: 'include' })
      .then(response => (response.ok ? response.json() : null))
      .then((json: InsightsData | null) => {
        if (!cancelled && json) setData(json);
      })
      .catch(() => {
        // Insights are supplementary — a failed fetch just leaves the panel hidden.
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!data || data.totalBatchesRanked < 1) return null;

  const belowThreshold = data.sampleSize < MIN_SAMPLE_FOR_RATES;
  const topStyle = data.styleWinRates[0];
  const topReferenceSet = data.topReferenceSets[0];
  const topProvider = data.providerAvgRank[0];

  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3',
        className
      )}
    >
      <h2 className="text-sm font-medium text-gray-300">Synthex is learning</h2>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-300">
        <span>{data.totalBatchesRanked} batches ranked</span>
        <span>{data.totalKept} kept</span>
        <span>{data.totalRejected} rejected</span>
        {data.groundedShare !== null && (
          <span>Grounded share: {Math.round(data.groundedShare * 100)}%</span>
        )}
      </div>

      {belowThreshold ? (
        <p className="text-xs text-white/40">
          Early data — keep ranking and Synthex learns what you like.
        </p>
      ) : (
        <div className="space-y-1 text-xs text-gray-400">
          {data.groundedWinRate !== null && (
            <p>
              Grounded win rate: {Math.round(data.groundedWinRate * 100)}%{' '}
              <span className="text-white/30">(n={data.sampleSize})</span>
            </p>
          )}
          {topStyle && (
            <p>
              Top style: {topStyle.style}{' '}
              <span className="text-white/30">(n={data.sampleSize})</span>
            </p>
          )}
          {topReferenceSet && (
            <p>
              Top reference set: {topReferenceSet.referenceSet}{' '}
              <span className="text-white/30">(n={data.sampleSize})</span>
            </p>
          )}
          {topProvider && (
            <p>
              Best-ranked provider: {topProvider.provider}{' '}
              <span className="text-white/30">(n={data.sampleSize})</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
