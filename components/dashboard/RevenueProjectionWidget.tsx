'use client';

/**
 * Revenue Projection Widget — SYN-485
 *
 * Projects monthly revenue uplift if tracked keywords reach top-3 positions,
 * using industry CTR curves and the org's actual revenue-per-click baseline.
 */

import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Loader2 } from '@/components/icons';
import type { RevenueProjection } from '@/lib/revenue/revenue-projector';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

const aud = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
});

// ── Loading skeleton ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-8 w-32 bg-white/[0.06] rounded-sm" />
      <div className="h-2 w-full bg-white/[0.04] rounded-full" />
      <div className="space-y-2 pt-1">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-sm border border-white/[0.06] bg-white/[0.03] px-3 py-2"
          >
            <div className="space-y-1.5 flex-1">
              <div className="h-2.5 w-36 bg-white/[0.08] rounded-sm" />
              <div className="h-2 w-24 bg-white/[0.05] rounded-sm" />
            </div>
            <div className="h-4 w-20 bg-white/[0.05] rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Widget ─────────────────────────────────────────────────────────────────────

export function RevenueProjectionWidget() {
  const { data, isLoading } = useSWR<RevenueProjection>(
    '/api/revenue/projection',
    fetcher,
    { revalidateOnFocus: false }
  );

  return (
    <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <TrendingUp className="h-4 w-4 text-orange-400" />
          Revenue Projection
        </CardTitle>
        <p className="text-xs text-gray-500 mt-0.5">
          Estimated monthly uplift if tracked keywords reach top 3
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && <LoadingSkeleton />}

        {!isLoading && data && !data.hasGSC && (
          <div className="py-6 text-center">
            <p className="text-sm text-gray-400">
              Connect Google Search Console to unlock revenue projections
            </p>
            <Link
              href="/dashboard/integrations"
              className="mt-3 inline-flex items-center gap-1.5 rounded-sm border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-500/20 hover:text-orange-200 transition-colors"
            >
              Connect GSC
            </Link>
          </div>
        )}

        {!isLoading && data && data.hasGSC && !data.hasKeywordTargets && (
          <div className="py-6 text-center">
            <p className="text-sm text-gray-400">
              Add keyword targets to enable projections
            </p>
            <Link
              href="/dashboard/seo/rankings"
              className="mt-3 inline-flex items-center gap-1.5 rounded-sm border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-500/20 hover:text-orange-200 transition-colors"
            >
              Add Keywords
            </Link>
          </div>
        )}

        {!isLoading && data && data.hasGSC && data.hasKeywordTargets && (
          <>
            {/* Uplift badge */}
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-emerald-400">
                +{aud.format(data.upliftAmount)}/mo
              </span>
              {data.upliftPercent > 0 && (
                <span className="text-xs text-emerald-500">
                  +{Math.round(data.upliftPercent)}% uplift
                </span>
              )}
            </div>

            {/* Current vs projected progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-gray-500">
                <span>
                  Current: {aud.format(data.currentMonthlyRevenue)}/mo
                </span>
                <span>
                  Projected: {aud.format(data.projectedMonthlyRevenue)}/mo
                </span>
              </div>
              <Progress
                value={
                  data.projectedMonthlyRevenue > 0
                    ? (data.currentMonthlyRevenue /
                        data.projectedMonthlyRevenue) *
                      100
                    : 0
                }
                className="h-1.5 bg-white/10"
              />
            </div>

            {/* Top 3 keywords by uplift potential */}
            <div className="space-y-1.5">
              {data.keywordBreakdown.slice(0, 3).map(kw => (
                <div
                  key={kw.keyword}
                  className="flex items-center justify-between rounded-sm border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-white font-medium truncate">
                      {kw.keyword}
                    </p>
                    <p className="text-gray-500 mt-0.5">
                      {kw.currentPosition !== null
                        ? `#${Math.round(kw.currentPosition)}`
                        : 'Not ranked'}{' '}
                      &rarr; #3
                    </p>
                  </div>
                  <span className="shrink-0 text-emerald-400 font-medium tabular-nums">
                    +{aud.format(kw.projectedUplift)}/mo
                  </span>
                </div>
              ))}
            </div>

            {/* Footer link */}
            <Link
              href="/dashboard/seo/rankings"
              className="block text-center text-xs text-gray-500 hover:text-orange-400 transition-colors pt-1"
            >
              View Rankings &rarr;
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
