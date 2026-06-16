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

const OPPORTUNITY_STYLES: Record<ContentGap['opportunity'], string> = {
  high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function CompetitorIntelligencePage() {
  const { data, isLoading, error } = useApi<{
    competitors: Competitor[];
    total: number;
  }>('/api/intelligence/competitors?action=list');

  const [platform, setPlatform] = useState<Platform>('instagram');
  const [gaps, setGaps] = useState<ContentGap[] | null>(null);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsError, setGapsError] = useState<string | null>(null);

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
        </>
      )}
    </div>
  );
}
