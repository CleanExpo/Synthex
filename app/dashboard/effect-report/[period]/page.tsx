'use client';

/**
 * /dashboard/effect-report/[period]
 *
 * In-platform Effect Report viewer.
 * period param = URL-encoded quarter label e.g. "Q1%202026"
 *
 * Renders all five sections (conditionally based on data availability).
 * Includes download links for PNG and PDF formats.
 * SYN-674
 */

import { use } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Download,
  Share2,
  TrendingUp,
  TrendingDown,
  Minus,
} from '@/components/icons';
import type { EffectReportData } from '@/lib/effect-report/types';

// ── Data fetching ─────────────────────────────────────────────────────────────

interface ReportResponse {
  reportId: string;
  quarterLabel: string;
  reportData: EffectReportData;
  pngUrl: string | null;
  pdfUrl: string | null;
}

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

// ── Delta indicator ───────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-green-400 text-sm font-semibold ml-2">
        <TrendingUp className="w-3.5 h-3.5" />+{delta}
      </span>
    );
  if (delta < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-red-400 text-sm font-semibold ml-2">
        <TrendingDown className="w-3.5 h-3.5" />
        {delta}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-gray-400 text-sm ml-2">
      <Minus className="w-3.5 h-3.5" />0
    </span>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function AchievementSection({
  data,
}: {
  data: EffectReportData['achievementSummary'];
}) {
  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold tracking-widest uppercase text-slate-400">
          Achievement Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-3xl font-extrabold text-white">
              {data.postsPublished.toLocaleString('en-AU')}
            </p>
            <p className="text-xs text-slate-400 mt-1">Posts published</p>
          </div>
          {data.estimatedTotalReach !== null && (
            <div>
              <p className="text-3xl font-extrabold text-white">
                {data.estimatedTotalReach.toLocaleString('en-AU')}
              </p>
              <p className="text-xs text-slate-400 mt-1">Estimated reach</p>
            </div>
          )}
          <div>
            <p className="text-3xl font-extrabold text-white">
              {data.advisorActionsTaken}
            </p>
            <p className="text-xs text-slate-400 mt-1">Advisor actions</p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-white">
              {data.consecutiveWeeksActive}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Consecutive weeks active
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricsSection({
  data,
}: {
  data: EffectReportData['proprietaryMetrics'];
}) {
  const hasAny =
    data.healthScore !== null ||
    data.geoScore !== null ||
    data.attributionRoi !== null;
  if (!hasAny) return null;

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold tracking-widest uppercase text-slate-400">
          Proprietary Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {data.healthScore !== null && (
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">Health Score</p>
            <p className="text-4xl font-extrabold text-white">
              {data.healthScore}
              <span className="text-lg text-slate-500">/100</span>
              <DeltaBadge delta={data.healthScoreQoQDelta} />
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Which means your marketing health is building.
            </p>
          </div>
        )}
        {data.geoScore !== null && (
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">GEO Score</p>
            <p className="text-4xl font-extrabold text-white">
              {data.geoScore}
              <span className="text-lg text-slate-500">/100</span>
              <DeltaBadge delta={data.geoScoreQoQDelta} />
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Which means your AI search visibility is measurable.
            </p>
          </div>
        )}
        {data.attributionRoi !== null && (
          <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-4">
            <p className="text-xs text-amber-400 mb-1">Attribution ROI</p>
            <p className="text-4xl font-extrabold text-amber-300">
              {data.attributionRoi}
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Estimated enquiry value attributed to Synthex.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BiggestWinSection({
  data,
}: {
  data: NonNullable<EffectReportData['biggestWin']>;
}) {
  return (
    <Card className="bg-amber-900/20 border-amber-700/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold tracking-widest uppercase text-amber-400">
          🏆 Biggest Win
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-white font-medium mb-1">
          On{' '}
          {new Date(data.date).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          , &ldquo;{data.postExcerpt}…&rdquo;
        </p>
        <p className="text-amber-300 font-bold">generated {data.metric}</p>
        {data.isAllTime && (
          <span className="mt-2 inline-block text-xs bg-amber-600/20 text-amber-300 px-2 py-0.5 rounded-full">
            All-time record
          </span>
        )}
      </CardContent>
    </Card>
  );
}

function HonestGapSection({
  data,
}: {
  data: NonNullable<EffectReportData['honestGap']>;
}) {
  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold tracking-widest uppercase text-slate-400">
          Honest Gap
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-white mb-1">
          Your <span className="font-semibold">{data.dimensionName}</span> score
          of <span className="font-bold">{data.dimensionScore}/100</span> is
          your lowest this quarter.
        </p>
        <p className="text-slate-300 text-sm mb-3">{data.recommendedAction}</p>
        <a
          href={data.deeplinkPath}
          className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2"
        >
          Fix it in Synthex →
        </a>
      </CardContent>
    </Card>
  );
}

function WhatsNextSection({
  data,
}: {
  data: NonNullable<EffectReportData['whatsNext']>;
}) {
  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold tracking-widest uppercase text-slate-400">
          What's Next
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-white leading-relaxed">{data.projection}</p>
        <p className="text-slate-500 text-xs mt-2">{data.confidenceBasis}</p>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EffectReportPage({
  params,
}: {
  params: Promise<{ period: string }>;
}) {
  const { period } = use(params);
  const quarterLabel = decodeURIComponent(period);

  const { data, isLoading, error } = useSWR<ReportResponse>(
    `/api/effect-report/by-period?quarter=${encodeURIComponent(quarterLabel)}`,
    fetchJson
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-pulse text-gray-400 text-sm">
          Loading Effect Report…
        </div>
      </div>
    );
  }

  if (error || !data?.reportData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-8">
        <p className="text-gray-400">
          Effect Report not found for {quarterLabel}.
        </p>
        <Link
          href="/dashboard/effect-report"
          className="mt-4 text-amber-400 hover:text-amber-300 text-sm underline"
        >
          Back to reports
        </Link>
      </div>
    );
  }

  const { reportId, reportData, pngUrl, pdfUrl } = data;
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-1">
            Synthex Effect Report · {quarterLabel}
          </p>
          <h1 className="text-2xl font-bold text-white">
            {reportData.businessName}
          </h1>
        </div>

        {/* Download actions */}
        <div className="flex gap-2 flex-wrap">
          {pngUrl && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-slate-600 text-slate-300 hover:text-white hover:border-slate-400"
            >
              <a href={pngUrl} download>
                <Share2 className="w-3.5 h-3.5 mr-1.5" />
                Share card
              </a>
            </Button>
          )}
          {pdfUrl && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-slate-600 text-slate-300 hover:text-white hover:border-slate-400"
            >
              <a href={pdfUrl} download>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                PDF
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Sections */}
      <AchievementSection data={reportData.achievementSummary} />
      <MetricsSection data={reportData.proprietaryMetrics} />
      {reportData.biggestWin && (
        <BiggestWinSection data={reportData.biggestWin} />
      )}
      {reportData.honestGap && <HonestGapSection data={reportData.honestGap} />}
      {reportData.whatsNext && <WhatsNextSection data={reportData.whatsNext} />}

      {/* Sharing PNG preview */}
      {pngUrl && (
        <div className="mt-4">
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">
            Shareable card
          </p>
          {}
          <img
            src={pngUrl}
            alt={`${reportData.businessName} Effect Report ${quarterLabel}`}
            className="w-64 h-64 rounded-xl border border-slate-700 object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Footer */}
      <p className="text-xs text-slate-600 text-center pt-4">
        Generated by Synthex ·{' '}
        {new Date(reportData.generatedAt).toLocaleDateString('en-AU')}
      </p>
    </div>
  );
}
