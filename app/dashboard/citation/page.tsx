'use client';

/**
 * Citation Performance Command Centre — Phase 99
 *
 * Unified dashboard aggregating data from all v5.0 GEO & Citation Engine phases.
 * Single-page layout (no tabs) with SWR auto-refresh every 60 seconds.
 *
 * URL: /dashboard/citation
 *
 * @module app/dashboard/citation/page
 */

import useSWR from 'swr';
import { CommandLine, RefreshCw } from '@/components/icons';
import { CitationScoreGauge } from '@/components/citation/CitationScoreGauge';
import { AgentActivityFeed } from '@/components/citation/AgentActivityFeed';
import { OpportunityPipeline } from '@/components/citation/OpportunityPipeline';
import { ScoreTrendChart } from '@/components/citation/ScoreTrendChart';
import { ModuleScoreGrid } from '@/components/citation/ModuleScoreGrid';
import type {
  OverviewStats,
  TimelinePoint,
  OpportunityItem,
} from '@/lib/citation/aggregator';

// ─── SWR fetcher ──────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error('Fetch failed');
  return r.json() as Promise<T>;
}

// ─── Response envelopes ──────────────────────────────────────────────────────

interface OverviewResponse {
  success: boolean;
  data: OverviewStats;
}

interface TimelineResponse {
  success: boolean;
  data: TimelinePoint[];
}

interface OpportunitiesResponse {
  success: boolean;
  data: OpportunityItem[];
}

// ─── Last updated helper ─────────────────────────────────────────────────────

function useLastUpdated(isValidating: boolean): string {
  // Use a simple "just now" or last SWR update
  return isValidating ? 'Refreshing…' : 'Updated just now';
}

// ─── Section card wrapper ────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-white/[0.02] border border-white/[0.07] p-5 ${className}`}
    >
      {title && (
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CitationDashboardPage() {
  const SWR_OPTS = { refreshInterval: 60_000 };

  const {
    data: overviewRes,
    isLoading: overviewLoading,
    isValidating: overviewValidating,
  } = useSWR<OverviewResponse>('/api/citation/overview', fetchJson, SWR_OPTS);

  const {
    data: timelineRes,
    isLoading: timelineLoading,
  } = useSWR<TimelineResponse>('/api/citation/timeline?days=30', fetchJson, SWR_OPTS);

  const {
    data: opportunitiesRes,
    isLoading: opportunitiesLoading,
  } = useSWR<OpportunitiesResponse>('/api/citation/opportunities', fetchJson, SWR_OPTS);

  const overview = overviewRes?.data;
  const timeline = timelineRes?.data ?? [];
  const opportunities = opportunitiesRes?.data ?? [];

  const lastUpdated = useLastUpdated(overviewValidating);

  // Derive sub-scores for gauge (0 when no data)
  const geoScore = overview?.geoSummary.avgScore ?? 0;
  const qualityScore = overview?.qualitySummary.avgQualityScore ?? 0;
  const eeatScore = overview?.qualitySummary.avgEeatScore ?? 0;
  // Authority: use entity coherence as proxy
  const authorityScore = overview?.entitySummary.avgCoherenceScore ?? 0;
  const promptCoverage = overview?.promptSummary.coverageRate ?? 0;

  return (
    <div className="min-h-screen text-white px-4 py-8 md:px-8 max-w-screen-2xl mx-auto">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10">
              <CommandLine className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Citation Performance Command Centre
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">
                Unified GEO + AI Citation Intelligence — all v5.0 modules in one view
              </p>
            </div>
          </div>

          {/* Last updated badge */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{lastUpdated}</span>
            <span className="text-gray-700">· auto-refreshes every 60s</span>
          </div>
        </div>
      </div>

      {/* ── Row 1: Score Gauge + Trend Chart ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Citation Score Gauge — 1 col */}
        <SectionCard className="flex flex-col items-center justify-center">
          <CitationScoreGauge
            geoScore={geoScore}
            qualityScore={qualityScore}
            eeatScore={eeatScore}
            authorityScore={authorityScore}
            promptCoverage={promptCoverage}
            loading={overviewLoading}
          />
        </SectionCard>

        {/* Score Trend Chart — 2 cols */}
        <SectionCard title="30-Day Score Trends" className="lg:col-span-2">
          <ScoreTrendChart data={timeline} loading={timelineLoading} />
        </SectionCard>
      </div>

      {/* ── Row 2: Module Score Grid ────────────────────────────────────── */}
      <SectionCard title="Module Status" className="mb-5">
        <ModuleScoreGrid overview={overview} loading={overviewLoading} />
      </SectionCard>

      {/* ── Row 3: Agent Activity + Opportunity Pipeline ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Agent Activity">
          <AgentActivityFeed
            activities={overview?.agentActivity ?? []}
            loading={overviewLoading}
          />
        </SectionCard>

        <SectionCard title="Opportunity Pipeline">
          <OpportunityPipeline
            items={opportunities}
            loading={opportunitiesLoading}
          />
        </SectionCard>
      </div>
    </div>
  );
}
