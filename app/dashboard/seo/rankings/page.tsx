'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Trash2,
  Loader2,
  BarChart3,
  Target,
  Sparkles,
} from '@/components/icons';

// ============================================================================
// Types
// ============================================================================

interface RankSnapshot {
  id: string;
  position: number | null;
  impressions: number | null;
  clicks: number | null;
  snapshotDate: string;
}

interface KeywordTarget {
  id: string;
  keyword: string;
  location: string | null;
  createdAt: string;
  snapshots: RankSnapshot[];
}

interface RankingsData {
  success: boolean;
  targets: KeywordTarget[];
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

function getPositionChange(snapshots: RankSnapshot[]): {
  change: number | null;
  trend: 'up' | 'down' | 'stable' | 'new';
} {
  if (snapshots.length < 2) {
    return { change: null, trend: snapshots.length === 1 ? 'new' : 'stable' };
  }
  const latest = snapshots[0].position;
  const previous = snapshots[snapshots.length - 1].position;
  if (latest === null || previous === null)
    return { change: null, trend: 'stable' };
  const change = Math.round(latest - previous);
  if (change < -0.5) return { change, trend: 'up' };
  if (change > 0.5) return { change, trend: 'down' };
  return { change: 0, trend: 'stable' };
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' | 'new' }) {
  if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (trend === 'down')
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
}

function MiniSparkline({ snapshots }: { snapshots: RankSnapshot[] }) {
  const positions = snapshots
    .slice()
    .reverse()
    .map(s => s.position);

  if (positions.every(p => p === null)) {
    return <span className="text-xs text-gray-500">No data</span>;
  }

  const validPositions = positions.filter((p): p is number => p !== null);
  const min = Math.min(...validPositions);
  const max = Math.max(...validPositions);
  const range = max - min || 1;

  const width = 80;
  const height = 24;
  const pts = positions.map((p, i) => {
    const x = (i / Math.max(positions.length - 1, 1)) * width;
    // Invert: lower position (better rank) → higher y value visually
    const y = p !== null ? height - ((max - p) / range) * height : height / 2;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="#f97316"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ============================================================================
// Page
// ============================================================================

export default function RankingsPage() {
  const { data, error, isLoading, mutate } = useSWR<RankingsData>(
    '/api/seo/rankings',
    fetchJson
  );

  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');

  const targets = data?.targets ?? [];
  const lastUpdated =
    targets.length > 0 && targets[0].snapshots.length > 0
      ? new Date(targets[0].snapshots[0].snapshotDate).toLocaleDateString(
          'en-AU'
        )
      : null;

  async function handleAdd() {
    if (!keyword.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      const res = await fetch('/api/seo/rankings/targets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          location: location.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to add keyword');
      setKeyword('');
      setLocation('');
      mutate();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Error adding keyword');
    } finally {
      setAdding(false);
    }
  }

  async function handleSeedFromGBP() {
    setSeeding(true);
    setSeedMessage('');
    try {
      const res = await fetch('/api/seo/rankings/seed', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Seed failed');
      setSeedMessage(json.message ?? 'Keywords seeded successfully.');
      mutate();
    } catch (err) {
      setSeedMessage(
        err instanceof Error ? err.message : 'Error seeding keywords'
      );
    } finally {
      setSeeding(false);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      await fetch(`/api/seo/rankings/targets/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      mutate();
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white/80">Keyword Rankings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track how your target keywords rank on Google via Search Console
            data
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              Last updated: {lastUpdated}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedFromGBP}
            disabled={seeding}
            title="Auto-generate keyword targets from your Google Business Profile"
          >
            {seeding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="ml-1">Seed from GBP</span>
          </Button>
        </div>
      </div>

      {seedMessage && (
        <div className="rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
          {seedMessage}
        </div>
      )}

      {/* Add Target */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" />
            Add Keyword Target
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="keyword" className="sr-only">
                Keyword
              </Label>
              <Input
                id="keyword"
                placeholder="e.g. plumber Parramatta"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="w-48">
              <Label htmlFor="location" className="sr-only">
                Location (optional)
              </Label>
              <Input
                id="location"
                placeholder="Location (optional)"
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>
            <Button onClick={handleAdd} disabled={adding || !keyword.trim()}>
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="ml-1">Add</span>
            </Button>
          </div>
          {addError && <p className="mt-2 text-sm text-red-500">{addError}</p>}
          <p className="mt-2 text-xs text-gray-400">
            Max 20 keywords · Rankings update weekly via Google Search Console
          </p>
        </CardContent>
      </Card>

      {/* Rankings Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}
          {error && (
            <div className="py-12 text-center text-sm text-red-500">
              Failed to load rankings
            </div>
          )}
          {!isLoading && !error && targets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BarChart3 className="mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">
                Add your target keywords to start tracking rank movement
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Rankings are pulled weekly from Google Search Console
              </p>
            </div>
          )}
          {!isLoading && targets.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      Keyword
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      Location
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">
                      Current Rank
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">
                      Change
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">
                      Impressions
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">
                      8-week trend
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {targets.map(target => {
                    const latest = target.snapshots[0] ?? null;
                    const { change, trend } = getPositionChange(
                      target.snapshots
                    );
                    return (
                      <tr
                        key={target.id}
                        className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/20"
                      >
                        <td className="px-4 py-3 font-medium text-white/80">
                          {target.keyword}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {target.location ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-lg font-bold text-white/80">
                          {formatPosition(latest?.position ?? null)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <TrendIcon trend={trend} />
                            {change !== null && change !== 0 && (
                              <span
                                className={
                                  trend === 'up'
                                    ? 'text-xs text-green-600'
                                    : 'text-xs text-red-500'
                                }
                              >
                                {trend === 'up' ? '+' : ''}
                                {-change}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                          {latest?.impressions != null
                            ? latest.impressions.toLocaleString()
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <MiniSparkline snapshots={target.snapshots} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(target.id)}
                            disabled={removingId === target.id}
                            className="text-gray-400 hover:text-red-500"
                          >
                            {removingId === target.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
