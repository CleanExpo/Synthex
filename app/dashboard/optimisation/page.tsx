'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { BOFeatureGate } from '@/components/bayesian/BOFeatureGate';
import { OptimisationSpaceCard } from '@/components/bayesian/OptimisationSpaceCard';
import type { BOSpaceData } from '@/components/bayesian/OptimisationSpaceCard';
import { RunHistoryTable } from '@/components/bayesian/RunHistoryTable';
import { Brain } from '@/components/icons';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

/**
 * AI Optimisation Dashboard — Bayesian Optimisation client-facing page.
 *
 * Shows:
 * - Active optimisation spaces with learning state and best parameters
 * - Run history table (empty state when no GET runs endpoint available)
 *
 * Gated: Pro+ plan required (BOFeatureGate).
 * Data: useSWR with credentials:include (per CLAUDE.md pattern).
 */
export default function OptimisationPage() {
  const {
    data: spacesData,
    isLoading: spacesLoading,
    mutate: mutateSpaces,
  } = useSWR('/api/bayesian/spaces', fetchJson, { refreshInterval: 30_000 });

  // No GET /api/bayesian/run endpoint exists — run history requires a Phase 103 follow-up.
  // RunHistoryTable receives an empty array and shows its empty state.
  const runsLoading = false;
  const runs: never[] = [];

  const [runningSpaceId, setRunningSpaceId] = useState<string | null>(null);

  const handleRunOptimisation = async (spaceId: string) => {
    setRunningSpaceId(spaceId);
    try {
      const response = await fetch('/api/bayesian/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ spaceId }),
      });
      if (response.ok) {
        void mutateSpaces();
      }
    } finally {
      setRunningSpaceId(null);
    }
  };

  const spaces: BOSpaceData[] = spacesData?.data ?? [];

  return (
    <BOFeatureGate>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Brain className="h-7 w-7 text-violet-400" />
              AI Optimisation
            </h1>
            <p className="text-gray-400 mt-1">
              Bayesian Optimisation — adaptive parameter tuning per organisation
            </p>
          </div>
        </div>

        {/* Active Optimisation Spaces */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Active Optimisation Spaces</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Spaces are provisioned automatically when your organisation uses GEO analysis.
            </p>
          </div>

          {spacesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse bg-white/5 rounded-xl border border-white/[0.05]"
                />
              ))}
            </div>
          ) : spaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 bg-white/[0.02] rounded-xl border border-white/[0.05]">
              <Brain className="h-10 w-10 mb-3 opacity-30 text-violet-400" />
              <p className="text-sm font-medium">No optimisation spaces yet</p>
              <p className="text-xs mt-2 max-w-sm text-center">
                Optimisation spaces are created automatically as your organisation runs GEO
                analyses, A/B experiments, and prompt tests. Run a GEO analysis to start
                the AI learning process.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {spaces.map((space) => (
                <OptimisationSpaceCard
                  key={space.id}
                  space={space}
                  onRunOptimisation={handleRunOptimisation}
                  isRunning={runningSpaceId === space.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* Run History */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Run History</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Past optimisation runs and their outcomes.
            </p>
          </div>

          <div className="bg-surface-base/80 backdrop-blur-xl border border-violet-500/10 rounded-xl p-4">
            <RunHistoryTable runs={runs} isLoading={runsLoading} />
          </div>
        </section>
      </div>
    </BOFeatureGate>
  );
}
