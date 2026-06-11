'use client';

import Link from 'next/link';
import { useApi } from '@/hooks/use-api';
import { ClaimActions } from './ClaimActions';

interface RunArtifactClaim {
  opportunityId: string;
  claimId: string;
  statement: string;
  warnings: string[];
}

interface RunArtifacts {
  claims?: RunArtifactClaim[];
  gaps?: string[];
  opportunityIds?: string[];
  campaignId?: string;
}

interface RunDetailResponse {
  run: {
    id: string;
    status: 'running' | 'completed' | 'failed' | 'queued' | 'cancelled';
    startedAt: string;
    completedAt: string | null;
    opportunitiesConsidered: number;
    claimsProposed: number;
    evidenceGapsFlagged: number;
    summary: string | null;
    errorMessage: string | null;
    artifacts: RunArtifacts;
    qaReportId: string | null;
    agent: { id: string; name: string; goal: string };
    qaReport: {
      id: string;
      status: string;
      blockedReasons: string[];
      warnings: string[];
      checks: Array<{ check: string; status: string; detail: string }>;
    } | null;
  };
}

function statusTone(status: string) {
  if (status === 'completed' || status === 'pass')
    return 'text-emerald-300 border-emerald-400/20';
  if (status === 'failed' || status === 'blocked')
    return 'text-red-300 border-red-400/20';
  if (status === 'review' || status === 'running')
    return 'text-orange-300 border-orange-400/20';
  return 'text-muted-foreground border-white/10';
}

export function AgentRunDetail({ runId }: { runId: string }) {
  const { data, isLoading, error } = useApi<RunDetailResponse>(
    `/api/marketing-agency/runs/${runId}`
  );

  if (isLoading)
    return <p className="text-sm text-muted-foreground">Loading run…</p>;
  if (error)
    return (
      <p className="text-sm text-red-300">
        Could not load run: {error.message}
      </p>
    );
  if (!data?.run)
    return <p className="text-sm text-muted-foreground">Run not found.</p>;

  const { run } = data;
  const artifacts = run.artifacts ?? {};

  return (
    <>
      <header className="flex flex-col gap-2">
        <Link
          href={`/dashboard/marketing-agency/agents/${run.agent.id}/runs`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← All runs for {run.agent.name}
        </Link>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-bold">Agent Run</h1>
          <span
            className={`rounded-sm border px-2 py-0.5 text-xs ${statusTone(run.status)}`}
          >
            {run.status}
          </span>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {run.agent.goal}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Opportunities reviewed"
          value={run.opportunitiesConsidered}
        />
        <Stat label="Claims proposed" value={run.claimsProposed} />
        <Stat label="Evidence gaps flagged" value={run.evidenceGapsFlagged} />
      </section>

      {run.summary && (
        <section className="rounded-sm border border-white/10 bg-white/[0.02] p-4 text-sm">
          {run.summary}
        </section>
      )}

      {run.errorMessage && (
        <section className="rounded-sm border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
          <strong className="block text-xs uppercase">Error</strong>
          {run.errorMessage}
        </section>
      )}

      {run.qaReport && (
        <section className="rounded-sm border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              QA Report
            </h2>
            <span
              className={`rounded-sm border px-2 py-0.5 text-xs ${statusTone(run.qaReport.status)}`}
            >
              {run.qaReport.status}
            </span>
          </div>
          {run.qaReport.blockedReasons.length > 0 && (
            <ul className="mt-3 list-inside list-disc text-sm">
              {run.qaReport.blockedReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          {run.qaReport.warnings.length > 0 && (
            <ul className="mt-3 list-inside list-disc text-sm text-orange-200">
              {run.qaReport.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          {run.qaReport.checks.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Check</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {run.qaReport.checks.map((c, i) => (
                    <tr
                      key={i}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="py-2 pr-3">{c.check}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-sm border px-1.5 py-0.5 ${statusTone(c.status)}`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2">{c.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {artifacts.claims && artifacts.claims.length > 0 && (
        <section className="rounded-sm border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Proposed Claims
          </h2>
          <ul className="mt-3 flex flex-col gap-3 text-sm">
            {artifacts.claims.map(c => (
              <li
                key={c.claimId}
                className="rounded-sm border border-white/10 p-3"
              >
                <p>{c.statement}</p>
                {c.warnings.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-xs text-orange-200">
                    {c.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
                <ClaimActions claimId={c.claimId} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
