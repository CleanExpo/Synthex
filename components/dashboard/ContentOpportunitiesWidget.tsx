'use client';

/**
 * Content Opportunities Widget
 *
 * Shows top 3 keyword opportunities (ranked 6–20) with a "Generate Article"
 * CTA linking to the content generator pre-filled with the keyword topic.
 *
 * SYN-482
 */

import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from '@/components/icons';

interface Recommendation {
  id: string;
  keyword: string;
  impressions: number;
  currentRank: number;
  opportunityScore: number;
}

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

// ── Loading skeleton ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-sm border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
        >
          <div className="space-y-1.5 flex-1">
            <div className="h-2.5 w-40 bg-white/[0.08] rounded-sm" />
            <div className="h-2 w-28 bg-white/[0.05] rounded-sm" />
          </div>
          <div className="h-6 w-20 bg-white/[0.05] rounded-sm" />
        </div>
      ))}
    </div>
  );
}

// ── Widget ────────────────────────────────────────────────────────────────────

export function ContentOpportunitiesWidget() {
  const { data, isLoading } = useSWR<{ recommendations: Recommendation[] }>(
    '/api/seo/recommendations',
    fetcher,
    { revalidateOnFocus: false }
  );

  const recommendations = data?.recommendations ?? [];

  return (
    <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <TrendingUp className="h-4 w-4 text-orange-400" />
          Keyword Opportunities
        </CardTitle>
        <p className="text-xs text-gray-500 mt-0.5">
          Topics ranked 6–20 — publish content to break into top 5
        </p>
      </CardHeader>

      <CardContent className="space-y-2">
        {isLoading && <LoadingSkeleton />}

        {!isLoading && recommendations.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-sm text-gray-400">
              Connect Google Search Console to unlock keyword opportunities
            </p>
          </div>
        )}

        {!isLoading &&
          recommendations.map(rec => (
            <div
              key={rec.id}
              className="flex items-center justify-between rounded-sm border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-sm text-white truncate font-medium">
                  {rec.keyword}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Rank #{Math.round(rec.currentRank)} &middot;{' '}
                  {rec.impressions.toLocaleString()} impressions
                </p>
              </div>
              <Link
                href={`/dashboard/content/generate?topic=${encodeURIComponent(rec.keyword)}`}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-sm border border-orange-500/30 bg-orange-500/10 px-2.5 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-500/20 hover:text-orange-200 transition-colors"
              >
                Generate
              </Link>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
