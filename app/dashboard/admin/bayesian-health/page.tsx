'use client';

import useSWR from 'swr';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

/**
 * BayesNF Service Health Dashboard
 *
 * Admin-only page (protected by app/dashboard/admin/layout.tsx — isOwnerEmail guard).
 * Displays real-time status of the Python AI service (Prophet + BayesNF engines)
 * and lists spatiotemporal models across all organisations.
 *
 * Data refreshes every 30 seconds.
 */
export default function BayesianHealthPage() {
  const {
    data,
    isLoading,
    mutate,
  } = useSWR('/api/admin/bayesian-health', fetchJson, { refreshInterval: 30_000 });

  const { data: modelsData } = useSWR('/api/predict/models', fetchJson);
  const models: Array<{
    id: string;
    name: string;
    orgId: string;
    status: string;
    trainingPoints: number;
  }> = modelsData?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">BayesNF Service Health</h1>
        <p className="text-gray-400 mt-1">
          Real-time status of the Python AI service (Prophet + BayesNF engines).
        </p>
      </div>

      {/* Service status card */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Service Status</h2>
          <button
            type="button"
            onClick={() => void mutate()}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="animate-pulse h-20 bg-white/5 rounded" />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  data?.status === 'reachable'
                    ? 'bg-emerald-400'
                    : data?.status === 'unconfigured'
                      ? 'bg-yellow-400'
                      : 'bg-red-400'
                }`}
              />
              <span className="text-sm text-white capitalize">{data?.status ?? 'unknown'}</span>
            </div>

            {data?.message && (
              <p className="text-xs text-yellow-400">{data.message as string}</p>
            )}

            {data?.data && (
              <pre className="text-xs text-gray-400 bg-black/30 rounded p-3 overflow-auto max-h-48">
                {JSON.stringify(data.data, null, 2)}
              </pre>
            )}

            {data?.error && (
              <p className="text-xs text-red-400">{data.error as string}</p>
            )}
          </div>
        )}
      </div>

      {/* Spatiotemporal models overview */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Spatiotemporal Models</h2>
        <p className="text-sm text-gray-400">
          {models.length} model{models.length !== 1 ? 's' : ''} across all organisations
        </p>

        {models.length > 0 && (
          <div className="mt-3 space-y-2">
            {models.slice(0, 10).map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between text-xs text-gray-400"
              >
                <span>
                  {m.name} ({m.orgId.slice(0, 8)}…)
                </span>
                <span
                  className={
                    m.status === 'ready'
                      ? 'text-emerald-400'
                      : m.status === 'failed'
                        ? 'text-red-400'
                        : 'text-yellow-400'
                  }
                >
                  {m.status} · {m.trainingPoints} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
