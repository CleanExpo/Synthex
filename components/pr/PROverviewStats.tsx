'use client';

/**
 * PR Journalist CRM — Overview Stats Component (Phase 92)
 *
 * Displays pipeline summary: journalists, active pitches, coverage, press releases.
 *
 * @module components/pr/PROverviewStats
 */

import useSWR from 'swr';
import { Users, Send, Globe, FileText, Loader2 } from '@/components/icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JournalistsResponse {
  contacts: Array<{ tier: string }>;
}

interface PitchesResponse {
  pitches: Array<{ status: string }>;
}

interface CoverageResponse {
  coverage: Array<{ createdAt: string }>;
}

interface ReleasesResponse {
  releases: Array<{ status: string }>;
}

// ---------------------------------------------------------------------------
// SWR fetcher
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PROverviewStats() {
  const { data: journalistsData, isLoading: jLoading } = useSWR<JournalistsResponse>(
    '/api/pr/journalists',
    fetchJson
  );
  const { data: pitchesData, isLoading: pLoading } = useSWR<PitchesResponse>(
    '/api/pr/pitches',
    fetchJson
  );
  const { data: coverageData, isLoading: cLoading } = useSWR<CoverageResponse>(
    '/api/pr/coverage',
    fetchJson
  );
  const { data: releasesData, isLoading: rLoading } = useSWR<ReleasesResponse>(
    '/api/pr/press-releases',
    fetchJson
  );

  const isLoading = jLoading || pLoading || cLoading || rLoading;

  const journalists = journalistsData?.contacts ?? [];
  const pitches = pitchesData?.pitches ?? [];
  const coverage = coverageData?.coverage ?? [];
  const releases = releasesData?.releases ?? [];

  // Compute stats
  const totalJournalists = journalists.length;
  const tierBreakdown = {
    hot:      journalists.filter((j) => j.tier === 'hot').length,
    warm:     journalists.filter((j) => j.tier === 'warm').length,
    advocate: journalists.filter((j) => j.tier === 'advocate').length,
  };
  const activePitches = pitches.filter((p) =>
    ['sent', 'opened', 'replied'].includes(p.status)
  ).length;
  const coverageThisMonth = coverage.filter((c) => isThisMonth(c.createdAt)).length;
  const publishedReleases = releases.filter((r) => r.status === 'published').length;

  const stats = [
    {
      icon: Users,
      label: 'Journalists',
      value: isLoading ? '—' : totalJournalists.toString(),
      sub: isLoading
        ? ''
        : `${tierBreakdown.hot} hot · ${tierBreakdown.warm} warm · ${tierBreakdown.advocate} advocate`,
      colour: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
    },
    {
      icon: Send,
      label: 'Active Pitches',
      value: isLoading ? '—' : activePitches.toString(),
      sub: isLoading ? '' : `${pitches.length} total pitches`,
      colour: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
    },
    {
      icon: Globe,
      label: 'Coverage This Month',
      value: isLoading ? '—' : coverageThisMonth.toString(),
      sub: isLoading ? '' : `${coverage.length} total coverage items`,
      colour: 'text-green-400',
      bg: 'bg-green-500/10 border-green-500/20',
    },
    {
      icon: FileText,
      label: 'Press Releases',
      value: isLoading ? '—' : publishedReleases.toString(),
      sub: isLoading ? '' : `${releases.length} total (${publishedReleases} published)`,
      colour: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`rounded-xl border p-4 backdrop-blur-xl ${stat.bg}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <stat.icon className={`h-4 w-4 ${stat.colour}`} />
            <span className="text-xs text-gray-400 font-medium">{stat.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
            ) : (
              <span className={`text-2xl font-bold ${stat.colour}`}>{stat.value}</span>
            )}
          </div>
          {stat.sub && (
            <p className="text-xs text-gray-500 mt-1 truncate">{stat.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}
