'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Target,
  ArrowLeft,
  Loader2,
  Plus,
  BarChart3,
  ExternalLink,
  FileText,
} from '@/components/icons';

// ============================================================================
// Types
// ============================================================================

interface DisplacementOpportunity {
  id: string;
  keyword: string;
  ourPosition: number | null;
  competitorName: string;
  competitorDomain: string;
  competitorPosition: number | null;
  gap: number | null;
  impressions: number | null;
  displacementScore: number | null;
}

interface TrackedCompetitorSummary {
  id: string;
  name: string;
  domain: string | null;
}

interface DisplacementData {
  opportunities: DisplacementOpportunity[];
  competitors: TrackedCompetitorSummary[];
}

// ============================================================================
// Fetcher
// ============================================================================

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

// ============================================================================
// Helpers
// ============================================================================

function formatPosition(pos: number | null): string {
  if (pos === null) return '—';
  return `#${Math.round(pos)}`;
}

function GapBadge({ gap }: { gap: number | null }) {
  if (gap === null) return <span className="text-gray-400">—</span>;
  return (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
      -{gap} positions
    </span>
  );
}

// ============================================================================
// Page
// ============================================================================

export default function DisplacementPage() {
  const { data, error, isLoading, mutate } = useSWR<DisplacementData>(
    '/api/seo/displacement',
    fetchJson
  );

  const [competitorName, setCompetitorName] = useState('');
  const [competitorDomain, setCompetitorDomain] = useState('');
  const [keyword, setKeyword] = useState('');
  const [competitorPosition, setCompetitorPosition] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const opportunities = data?.opportunities ?? [];
  const competitors = data?.competitors ?? [];

  async function handleAddCompetitor() {
    if (!competitorName.trim() || !competitorDomain.trim() || !keyword.trim())
      return;
    setAdding(true);
    setAddError('');
    try {
      const res = await fetch('/api/seo/displacement/competitors', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: competitorName.trim(),
          domain: competitorDomain.trim(),
          keyword: keyword.trim(),
          competitorPosition: competitorPosition
            ? parseFloat(competitorPosition)
            : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to add competitor');
      setCompetitorName('');
      setCompetitorDomain('');
      setKeyword('');
      setCompetitorPosition('');
      mutate();
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : 'Error adding competitor'
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/dashboard/seo"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            SEO Dashboard
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white/80">
            <Target className="h-6 w-6 text-orange-500" />
            Competitor Displacement
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Keywords where competitors outrank you — ranked by traffic impact
          </p>
        </div>
      </div>

      {/* Add Competitor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            Track a Keyword Gap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label
                htmlFor="comp-name"
                className="mb-1 block text-xs text-gray-500"
              >
                Competitor name
              </Label>
              <Input
                id="comp-name"
                placeholder="e.g. HubSpot"
                value={competitorName}
                onChange={e => setCompetitorName(e.target.value)}
              />
            </div>
            <div>
              <Label
                htmlFor="comp-domain"
                className="mb-1 block text-xs text-gray-500"
              >
                Competitor domain
              </Label>
              <Input
                id="comp-domain"
                placeholder="e.g. hubspot.com"
                value={competitorDomain}
                onChange={e => setCompetitorDomain(e.target.value)}
              />
            </div>
            <div>
              <Label
                htmlFor="gap-keyword"
                className="mb-1 block text-xs text-gray-500"
              >
                Keyword
              </Label>
              <Input
                id="gap-keyword"
                placeholder="e.g. marketing automation"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCompetitor()}
              />
            </div>
            <div>
              <Label
                htmlFor="comp-position"
                className="mb-1 block text-xs text-gray-500"
              >
                Their position (optional)
              </Label>
              <Input
                id="comp-position"
                type="number"
                min="1"
                placeholder="e.g. 3"
                value={competitorPosition}
                onChange={e => setCompetitorPosition(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button
              onClick={handleAddCompetitor}
              disabled={
                adding ||
                !competitorName.trim() ||
                !competitorDomain.trim() ||
                !keyword.trim()
              }
            >
              {adding ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1.5 h-4 w-4" />
              )}
              Add Gap
            </Button>
            <p className="text-xs text-gray-400">
              Our position is auto-synced from Google Search Console weekly
            </p>
          </div>
          {addError && <p className="mt-2 text-sm text-red-500">{addError}</p>}
        </CardContent>
      </Card>

      {/* Displacement Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Displacement Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}

          {error && (
            <div className="py-12 text-center text-sm text-red-500">
              Failed to load displacement data
            </div>
          )}

          {!isLoading && !error && competitors.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BarChart3 className="mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">
                Add a competitor to start tracking keyword gaps
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Enter a competitor&apos;s domain and a keyword where they
                outrank you to get started
              </p>
            </div>
          )}

          {!isLoading &&
            !error &&
            competitors.length > 0 &&
            opportunities.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Target className="mb-3 h-10 w-10 text-green-400" />
                <p className="text-sm font-medium text-gray-500">
                  No displacement opportunities found
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  We may already outrank all tracked competitors on these
                  keywords, or position data hasn&apos;t synced yet
                </p>
              </div>
            )}

          {!isLoading && opportunities.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      Keyword
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">
                      Our Rank
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      Competitor
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">
                      Their Rank
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">
                      Gap
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">
                      Impressions
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map(opp => (
                    <tr
                      key={opp.id}
                      className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/20"
                    >
                      <td className="px-4 py-3 font-medium text-white/80">
                        {opp.keyword}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-base font-bold text-white/80">
                        {formatPosition(opp.ourPosition)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {opp.competitorName}
                          </span>
                          {opp.competitorDomain && (
                            <a
                              href={`https://${opp.competitorDomain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        {opp.competitorDomain && (
                          <p className="text-xs text-gray-400">
                            {opp.competitorDomain}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-base font-bold text-red-500">
                        {formatPosition(opp.competitorPosition)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <GapBadge gap={opp.gap} />
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                        {opp.impressions != null
                          ? opp.impressions.toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                        >
                          <Link
                            href={`/dashboard/content/generate?topic=${encodeURIComponent(opp.keyword)}`}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Generate Article
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tracked Competitors Summary */}
      {competitors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tracked Competitors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {competitors.map(c => (
                <div
                  key={c.id}
                  className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm dark:border-gray-700 dark:bg-gray-800/50"
                >
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {c.name}
                  </span>
                  {c.domain && (
                    <span className="text-xs text-gray-400">{c.domain}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
