'use client';

/**
 * Competitor Intelligence console — backlog #10 (CRM/SEO §8).
 *
 * Surfaces the EXISTING competitive-intel engine (lib/services/competitive-intel.ts)
 * via its EXISTING API (/api/intelligence/competitors), which had no dashboard page.
 * Slice 1: competitor list + content-gap report (the spec's headline). No new API.
 * Benchmark report is a clean follow-up slice. Spec: spec.md §8 #10.
 */

import { useState } from 'react';
import { useApi } from '@/hooks/use-api';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Platform =
  | 'instagram'
  | 'twitter'
  | 'tiktok'
  | 'linkedin'
  | 'facebook'
  | 'youtube';

const PLATFORMS: Platform[] = [
  'instagram',
  'twitter',
  'tiktok',
  'linkedin',
  'facebook',
  'youtube',
];

interface Competitor {
  id: string;
  name: string;
  industry?: string;
  isActive: boolean;
}

interface ContentGap {
  topic: string;
  competitorsCovering: string[];
  avgEngagement: number;
  yourCoverage: boolean;
  opportunity: 'high' | 'medium' | 'low';
  suggestedApproach: string;
}

interface MetricSet {
  followers: number;
  followersGrowth: number;
  avgEngagementRate: number;
  postsPerWeek: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
}

interface BenchmarkReport {
  competitors: string[];
  platforms: string[];
  metrics: {
    your: MetricSet;
    industryAvg: MetricSet;
    topPerformer: MetricSet;
    bottomPerformer: MetricSet;
  };
  rankings: {
    metric: string;
    yourRank: number;
    totalCompetitors: number;
    percentile: number;
  }[];
  gaps: {
    metric: string;
    yourValue: number;
    benchmarkValue: number;
    gap: number;
    gapPercent: number;
    priority: 'high' | 'medium' | 'low';
    recommendations: string[];
  }[];
  opportunities: string[];
  threats: string[];
}

const OPPORTUNITY_STYLES: Record<ContentGap['opportunity'], string> = {
  high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

const PRIORITY_STYLES: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-rose-50 text-rose-700 border-rose-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

// The seven MetricSet fields the engine always populates (videoViews / reachRate
// are optional and never set by the metric getters — see competitive-intel.ts).
const METRIC_ROWS: { key: keyof MetricSet; label: string; decimals: number }[] =
  [
    { key: 'followers', label: 'Followers', decimals: 0 },
    { key: 'followersGrowth', label: 'Follower growth', decimals: 0 },
    { key: 'avgEngagementRate', label: 'Avg engagement rate', decimals: 2 },
    { key: 'postsPerWeek', label: 'Posts per week', decimals: 1 },
    { key: 'avgLikes', label: 'Avg likes', decimals: 0 },
    { key: 'avgComments', label: 'Avg comments', decimals: 0 },
    { key: 'avgShares', label: 'Avg shares', decimals: 0 },
  ];

function formatMetric(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function CompetitorIntelligencePage() {
  const { data, isLoading, error } = useApi<{
    competitors: Competitor[];
    total: number;
  }>('/api/intelligence/competitors?action=list');

  const [platform, setPlatform] = useState<Platform>('instagram');
  const [gaps, setGaps] = useState<ContentGap[] | null>(null);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsError, setGapsError] = useState<string | null>(null);

  // Benchmark report state
  const [selectedCompetitorIds, setSelectedCompetitorIds] = useState<string[]>(
    []
  );
  const [benchmarkPlatforms, setBenchmarkPlatforms] = useState<Platform[]>([
    'instagram',
  ]);
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const competitors = data?.competitors ?? [];

  async function loadGaps(p: Platform) {
    setGapsLoading(true);
    setGapsError(null);
    try {
      const res = await fetch(
        '/api/intelligence/competitors?action=gaps',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ platform: p }),
        }
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const body = await res.json();
      setGaps(body.gaps ?? []);
    } catch (e) {
      setGapsError(e instanceof Error ? e.message : 'Failed to load gaps');
      setGaps(null);
    } finally {
      setGapsLoading(false);
    }
  }

  function toggleCompetitor(id: string) {
    setSelectedCompetitorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleBenchmarkPlatform(p: Platform) {
    setBenchmarkPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function generateBenchmark() {
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await fetch(
        '/api/intelligence/competitors?action=benchmark',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            // Omit competitorIds to benchmark against all tracked competitors.
            competitorIds: selectedCompetitorIds.length
              ? selectedCompetitorIds
              : undefined,
            platforms: benchmarkPlatforms,
          }),
        }
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const body = await res.json();
      setReport(body.report ?? null);
    } catch (e) {
      setReportError(
        e instanceof Error ? e.message : 'Failed to generate benchmark'
      );
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intelligence"
        title="Competitor Intelligence"
        description="Track competitors and find the content gaps worth filling."
      />

      {/* Competitor list */}
      {isLoading && (
        <div className="h-20 animate-pulse rounded-lg border border-slate-100 bg-slate-50" />
      )}
      {error && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-red-600">
            Couldn&apos;t load competitors. {error.message}
          </CardContent>
        </Card>
      )}
      {!isLoading && !error && competitors.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-light text-slate-500">
              No competitors tracked yet. Add competitors to unlock content-gap
              analysis.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && competitors.length > 0 && (
        <>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">
              {data?.total ?? competitors.length} competitor
              {(data?.total ?? competitors.length) === 1 ? '' : 's'} tracked
            </p>
            <div className="flex flex-wrap gap-2">
              {competitors.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full border border-slate-200 px-3 py-1 text-sm font-light text-slate-700"
                >
                  {c.name}
                  {c.industry ? (
                    <span className="text-slate-400"> · {c.industry}</span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>

          {/* Content-gap report */}
          <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-5">
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
                Platform
              </span>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-light capitalize text-slate-700"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p} className="capitalize">
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <Button onClick={() => loadGaps(platform)} disabled={gapsLoading}>
              {gapsLoading ? 'Analysing…' : 'Find content gaps'}
            </Button>
          </div>

          {gapsError && (
            <p className="text-sm text-red-600">{gapsError}</p>
          )}

          {gaps !== null && gaps.length === 0 && !gapsLoading && (
            <p className="text-sm font-light text-slate-500">
              No content gaps found for {platform} — your coverage matches the
              tracked competitors.
            </p>
          )}

          {gaps !== null && gaps.length > 0 && (
            <div className="space-y-3">
              {gaps.map((g, i) => (
                <Card key={`${g.topic}-${i}`}>
                  <CardContent className="space-y-2 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-light text-slate-900">{g.topic}</h3>
                      <Badge
                        variant="outline"
                        className={OPPORTUNITY_STYLES[g.opportunity]}
                      >
                        {g.opportunity} opportunity
                      </Badge>
                    </div>
                    <p className="text-sm font-light text-slate-600">
                      {g.suggestedApproach}
                    </p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                      <span>
                        {g.competitorsCovering.length} competitor
                        {g.competitorsCovering.length === 1 ? '' : 's'} covering
                      </span>
                      <span>avg engagement {Math.round(g.avgEngagement)}</span>
                      <span>
                        your coverage: {g.yourCoverage ? 'yes' : 'none'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Benchmark report */}
          <div className="space-y-4 border-t border-slate-100 pt-5">
            <div>
              <h2 className="font-light text-slate-900">Benchmark</h2>
              <p className="text-sm font-light text-slate-500">
                Measure your metrics against your tracked competitors. Leave
                competitors unselected to benchmark against all of them.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">
                  Competitors
                </p>
                <div className="flex flex-wrap gap-2">
                  {competitors.map((c) => {
                    const active = selectedCompetitorIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCompetitor(c.id)}
                        className={`rounded-full border px-3 py-1 text-sm font-light transition-colours ${
                          active
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">
                  Platforms
                </p>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => {
                    const active = benchmarkPlatforms.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => toggleBenchmarkPlatform(p)}
                        className={`rounded-full border px-3 py-1 text-sm font-light capitalize transition-colours ${
                          active
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={generateBenchmark}
                disabled={reportLoading || benchmarkPlatforms.length === 0}
              >
                {reportLoading ? 'Generating…' : 'Generate benchmark'}
              </Button>
            </div>

            {reportError && (
              <p className="text-sm text-red-600">{reportError}</p>
            )}

            {report && !reportLoading && (
              <div className="space-y-4">
                {/* Metrics comparison table */}
                <Card>
                  <CardContent className="overflow-x-auto py-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                          <th className="py-2 pr-4 font-normal">Metric</th>
                          <th className="py-2 pr-4 font-normal">You</th>
                          <th className="py-2 pr-4 font-normal">Industry avg</th>
                          <th className="py-2 pr-4 font-normal">Top</th>
                          <th className="py-2 pr-4 font-normal">Bottom</th>
                        </tr>
                      </thead>
                      <tbody>
                        {METRIC_ROWS.map((row) => (
                          <tr
                            key={row.key}
                            className="border-b border-slate-50 last:border-0"
                          >
                            <td className="py-2 pr-4 font-light text-slate-700">
                              {row.label}
                            </td>
                            <td className="py-2 pr-4 font-light text-slate-900">
                              {formatMetric(
                                report.metrics.your[row.key],
                                row.decimals
                              )}
                            </td>
                            <td className="py-2 pr-4 font-light text-slate-600">
                              {formatMetric(
                                report.metrics.industryAvg[row.key],
                                row.decimals
                              )}
                            </td>
                            <td className="py-2 pr-4 font-light text-slate-600">
                              {formatMetric(
                                report.metrics.topPerformer[row.key],
                                row.decimals
                              )}
                            </td>
                            <td className="py-2 pr-4 font-light text-slate-600">
                              {formatMetric(
                                report.metrics.bottomPerformer[row.key],
                                row.decimals
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-3 text-xs text-slate-400">
                      Benchmarked against {report.competitors.length} competitor
                      {report.competitors.length === 1 ? '' : 's'} across{' '}
                      {report.platforms.join(', ') || 'no platforms'}.
                    </p>
                  </CardContent>
                </Card>

                {/* Rankings */}
                {report.rankings.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">
                      Your rankings
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {report.rankings.map((r) => (
                        <Card key={r.metric}>
                          <CardContent className="py-4">
                            <p className="text-sm font-light text-slate-700">
                              {r.metric}
                            </p>
                            <p className="mt-1 text-slate-900">
                              #{r.yourRank}{' '}
                              <span className="text-sm font-light text-slate-400">
                                of {r.totalCompetitors}
                              </span>
                            </p>
                            <p className="text-xs text-slate-500">
                              {Math.round(r.percentile)}th percentile
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gaps */}
                {report.gaps.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">
                      Performance gaps
                    </p>
                    <div className="space-y-3">
                      {report.gaps.map((g) => (
                        <Card key={g.metric}>
                          <CardContent className="space-y-2 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="font-light text-slate-900">
                                {g.metric}
                              </h3>
                              <Badge
                                variant="outline"
                                className={PRIORITY_STYLES[g.priority]}
                              >
                                {g.priority} priority
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                              <span>you {formatMetric(g.yourValue, 1)}</span>
                              <span>
                                benchmark {formatMetric(g.benchmarkValue, 1)}
                              </span>
                              <span>
                                gap {formatMetric(g.gap, 1)} (
                                {Math.round(g.gapPercent)}%)
                              </span>
                            </div>
                            {g.recommendations.length > 0 && (
                              <ul className="list-disc space-y-1 pl-5 text-sm font-light text-slate-600">
                                {g.recommendations.map((rec, ri) => (
                                  <li key={ri}>{rec}</li>
                                ))}
                              </ul>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Opportunities & threats */}
                {(report.opportunities.length > 0 ||
                  report.threats.length > 0) && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {report.opportunities.length > 0 && (
                      <Card>
                        <CardContent className="space-y-2 py-4">
                          <p className="text-xs uppercase tracking-wide text-emerald-600">
                            Opportunities
                          </p>
                          <ul className="list-disc space-y-1 pl-5 text-sm font-light text-slate-600">
                            {report.opportunities.map((o, oi) => (
                              <li key={oi}>{o}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                    {report.threats.length > 0 && (
                      <Card>
                        <CardContent className="space-y-2 py-4">
                          <p className="text-xs uppercase tracking-wide text-rose-600">
                            Threats
                          </p>
                          <ul className="list-disc space-y-1 pl-5 text-sm font-light text-slate-600">
                            {report.threats.map((t, ti) => (
                              <li key={ti}>{t}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {report.rankings.length === 0 &&
                  report.gaps.length === 0 &&
                  report.opportunities.length === 0 &&
                  report.threats.length === 0 && (
                    <p className="text-sm font-light text-slate-500">
                      No benchmark signal yet — once your account and the
                      selected competitors have metrics in this period, rankings
                      and gaps will appear here.
                    </p>
                  )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
