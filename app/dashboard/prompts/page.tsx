'use client';

/**
 * Prompt Intelligence Dashboard (Phase 96)
 *
 * 3 tabs:
 *  - Discovery  — generate + discover prompts for an entity
 *  - Tracking   — list tracked prompts, test them, view results
 *  - Gaps       — visual gap analysis + competitor visibility
 *
 * URL: /dashboard/prompts?tab=discovery|tracking|gaps
 *
 * @module app/dashboard/prompts/page
 */

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Search, TrendingUp } from '@/components/icons';
import { PromptCard }                from '@/components/prompts/PromptCard';
import { PromptGapChart }            from '@/components/prompts/PromptGapChart';
import { CompetitorVisibilityTable } from '@/components/prompts/CompetitorVisibilityTable';
import { PromptGeneratorForm }       from '@/components/prompts/PromptGeneratorForm';
import { useUser }                   from '@/hooks/use-user';
import type { PromptCardData }       from '@/components/prompts/PromptCard';
import type { PromptGapAnalysis, CompetitorVisibility } from '@/lib/prompts/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type PromptsTab = 'discovery' | 'tracking' | 'gaps';
const VALID_TABS: PromptsTab[] = ['discovery', 'tracking', 'gaps'];

// ─── SWR fetcher ──────────────────────────────────────────────────────────────

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error('Fetch failed');
    return r.json();
  });

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-xs font-medium text-slate-300 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Tracking Tab ─────────────────────────────────────────────────────────────

interface TrackerListData {
  trackers: PromptCardData[]
  total: number
}

function TrackingTab({ orgId }: { orgId: string }) {
  const [statusFilter, setStatusFilter]   = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [testingAll, setTestingAll]       = useState(false);

  const params = new URLSearchParams();
  if (statusFilter)   params.set('status', statusFilter);
  if (categoryFilter) params.set('category', categoryFilter);
  if (orgId)          params.set('orgId', orgId);
  const swrKey = `/api/prompts/trackers?${params.toString()}`;

  const { data, error, isLoading } = useSWR<TrackerListData>(swrKey, fetchJson, {
    refreshInterval: 30_000,
  });

  const trackers = data?.trackers ?? [];
  const tested   = trackers.filter((t) => t.status === 'tested');
  const mentioned = tested.filter((t) => t.brandMentioned === true);
  const coverage  = tested.length > 0 ? Math.round((mentioned.length / tested.length) * 100) : 0;

  // ── Test All Untested (max 5 at once) ──
  async function handleTestAll() {
    const untested = trackers.filter((t) => t.status === 'pending');
    if (untested.length === 0) return;

    setTestingAll(true);
    const batch = untested.slice(0, 5);

    for (const tracker of batch) {
      try {
        await fetch('/api/prompts/test', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackerId: tracker.id }),
        });
      } catch {
        // continue on error
      }
    }

    await mutate(swrKey);
    setTestingAll(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
        Failed to load trackers. Please refresh.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Tracked" value={data?.total ?? 0} />
        <StatCard label="Tested" value={tested.length} />
        <StatCard label="Mentioned" value={mentioned.length} />
        <StatCard label="Coverage" value={`${coverage}%`} sub="mention rate" />
      </div>

      {/* Filters + Test All */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-md border border-white/20 bg-white/5 text-slate-300 text-xs px-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          <option value="">All statuses</option>
          <option value="pending">Not tested</option>
          <option value="tested">Tested</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-8 rounded-md border border-white/20 bg-white/5 text-slate-300 text-xs px-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          <option value="">All categories</option>
          <option value="brand-awareness">Brand Awareness</option>
          <option value="competitor-comparison">Competitor Comparison</option>
          <option value="local-discovery">Local Discovery</option>
          <option value="use-case">Use Case</option>
          <option value="how-to">How-To</option>
          <option value="product-feature">Product Feature</option>
        </select>
        <div className="flex-1" />
        {trackers.some((t) => t.status === 'pending') && (
          <button
            onClick={handleTestAll}
            disabled={testingAll}
            className="px-3 py-1.5 text-xs rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
          >
            {testingAll ? 'Testing…' : `Test Untested (max 5)`}
          </button>
        )}
      </div>

      {/* Prompt cards */}
      {trackers.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <Sparkles className="w-8 h-8 text-slate-500 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No prompts tracked yet.</p>
          <p className="text-xs text-slate-500 mt-1">
            Go to the Discovery tab to generate and track prompts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {trackers.map((tracker) => (
            <PromptCard
              key={tracker.id}
              tracker={tracker}
              onTested={() => mutate(swrKey)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Gaps Tab ─────────────────────────────────────────────────────────────────

interface GapsData {
  gapAnalysis: PromptGapAnalysis | null
  competitors: CompetitorVisibility[]
  message?: string
}

function GapsTab({ orgId }: { orgId: string }) {
  const url = orgId ? `/api/prompts/gaps?orgId=${orgId}` : '/api/prompts/gaps';
  const { data, error, isLoading } = useSWR<GapsData>(url, fetchJson);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
        Failed to load gap analysis. Please refresh.
      </div>
    );
  }

  if (!data?.gapAnalysis) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <TrendingUp className="w-8 h-8 text-slate-500 mx-auto mb-3" />
        <p className="text-sm text-slate-400">
          {data?.message ?? 'No tested prompts found.'}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Test some prompts in the Tracking tab to see gap analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Gap Chart */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-sm font-semibold text-white mb-5">Visibility Gap Analysis</h3>
        <PromptGapChart analysis={data.gapAnalysis} />
      </div>

      {/* Competitor Table */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Competitor Visibility</h3>
        <CompetitorVisibilityTable competitors={data.competitors} />
      </div>
    </div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function PromptsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user }     = useUser();

  const orgId = user?.organizationId ?? '';

  const rawTab  = searchParams.get('tab') ?? 'discovery';
  const activeTab: PromptsTab = VALID_TABS.includes(rawTab as PromptsTab)
    ? (rawTab as PromptsTab)
    : 'discovery';

  const [trackedCount, setTrackedCount] = useState(0);

  function setTab(tab: PromptsTab) {
    router.push(`/dashboard/prompts?tab=${tab}`);
  }

  const handleTracked = useCallback((count: number) => {
    setTrackedCount((prev) => prev + count);
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-cyan-400" />
            Prompt Intelligence
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Discover which AI prompts trigger brand mentions — find gaps and track visibility across ChatGPT, Perplexity, and Claude.
          </p>
        </div>
        {trackedCount > 0 && (
          <span className="shrink-0 px-3 py-1 rounded-full text-xs bg-green-500/15 text-green-400 border border-green-500/25">
            +{trackedCount} tracked this session
          </span>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setTab(v as PromptsTab)}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="discovery" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
            <Search className="w-3.5 h-3.5 mr-1.5" />
            Discovery
          </TabsTrigger>
          <TabsTrigger value="tracking" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Tracking
          </TabsTrigger>
          <TabsTrigger value="gaps" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
            Gaps
          </TabsTrigger>
        </TabsList>

        {/* Discovery tab */}
        <TabsContent value="discovery" className="mt-5">
          <PromptGeneratorForm orgId={orgId} onTracked={handleTracked} />
        </TabsContent>

        {/* Tracking tab */}
        <TabsContent value="tracking" className="mt-5">
          <TrackingTab orgId={orgId} />
        </TabsContent>

        {/* Gaps tab */}
        <TabsContent value="gaps" className="mt-5">
          <GapsTab orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
