'use client';

import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/use-api';

interface RunSummary {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  opportunitiesConsidered: number;
  claimsProposed: number;
  evidenceGapsFlagged: number;
  summary: string | null;
  errorMessage: string | null;
}

interface AgentInfo {
  id: string;
  name: string;
  goal: string;
}

async function postCancel(
  runId: string
): Promise<{ run: { id: string; status: string } }> {
  const res = await fetch(
    `/api/marketing-agency/runs/${encodeURIComponent(runId)}/cancel`,
    { method: 'POST', credentials: 'include' }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Cancel failed (${res.status})`);
  }
  return res.json() as Promise<{ run: { id: string; status: string } }>;
}

function CancelRunButton({ runId }: { runId: string }) {
  // Use the shared `useMutation` hook for consistent loading/error
  // semantics across the codebase (CodeRabbit finding — raw fetch
  // bypassed the project's hooks layer).
  const mutation = useMutation<{ run: { id: string; status: string } }, void>(
    () => postCancel(runId)
  );

  if (mutation.data) {
    return <span className="text-xs text-emerald-300">Cancelled</span>;
  }

  return (
    <>
      <button
        type="button"
        className="rounded-sm bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-200 hover:bg-red-500/30 disabled:opacity-50"
        disabled={mutation.isLoading}
        onClick={() => mutation.mutate()}
      >
        {mutation.isLoading ? 'Cancelling…' : 'Cancel'}
      </button>
      {mutation.error && (
        <span className="text-xs text-red-300">{mutation.error.message}</span>
      )}
    </>
  );
}

export function AgentRunHistory({ agentId }: { agentId: string }) {
  const { data: agentData } = useApi<{ agent: AgentInfo }>(
    `/api/marketing-agency/agents/${agentId}`
  );
  const { data, isLoading, error } = useApi<{ runs: RunSummary[] }>(
    `/api/marketing-agency/agents/${agentId}/runs?limit=20`,
    { pollingInterval: 15_000 }
  );

  const runs = data?.runs ?? [];

  return (
    <>
      <header className="flex flex-col gap-2">
        <Link
          href="/dashboard/marketing-agency"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Marketing Agency
        </Link>
        <h1 className="text-2xl font-bold">
          {agentData?.agent?.name ?? 'Agent'} — Run History
        </h1>
        {agentData?.agent?.goal && (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {agentData.agent.goal}
          </p>
        )}
      </header>

      {error && (
        <p className="text-sm text-red-300">
          Could not load runs: {error.message}
        </p>
      )}
      {isLoading && !data && (
        <p className="text-sm text-muted-foreground">Loading runs…</p>
      )}

      {!isLoading && runs.length === 0 && !error && (
        <p className="rounded-sm border border-white/10 px-4 py-4 text-sm text-muted-foreground">
          No runs yet. Trigger one from the agent's "Run Now" button.
        </p>
      )}

      {runs.length > 0 && (
        <div className="overflow-x-auto rounded-sm border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Reviewed</th>
                <th className="px-4 py-3 text-right">Proposed</th>
                <th className="px-4 py-3 text-right">Gaps</th>
                <th className="px-4 py-3">Summary</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr
                  key={r.id}
                  className="border-b border-white/5 last:border-0"
                >
                  <td className="px-4 py-3 align-top text-xs">
                    {new Date(r.startedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 align-top text-xs">{r.status}</td>
                  <td className="px-4 py-3 align-top text-right">
                    {r.opportunitiesConsidered}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    {r.claimsProposed}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    {r.evidenceGapsFlagged}
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                    {r.errorMessage ?? r.summary ?? '—'}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex items-center justify-end gap-2">
                      {(r.status === 'queued' || r.status === 'running') && (
                        <CancelRunButton runId={r.id} />
                      )}
                      <Link
                        href={`/dashboard/marketing-agency/runs/${r.id}`}
                        className="text-xs hover:underline"
                      >
                        Open →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
