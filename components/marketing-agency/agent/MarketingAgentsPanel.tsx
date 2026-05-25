'use client';

/**
 * MarketingAgentsPanel — entry surface for the agentic loop on the
 * /dashboard/marketing-agency page. Lists the org's agents, lets the
 * operator create one, run one, or jump to run history.
 *
 * Pairs with the existing GovernedOpportunitiesPanel (which shows the
 * substrate the agents act on). This panel never bypasses any QA gate
 * — running an agent only proposes claims and writes a blocked QaReport.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/hooks/use-api';
import { CreateAgentDialog } from './CreateAgentDialog';
import { RunAgentButton } from './RunAgentButton';

interface AgentSummary {
  id: string;
  name: string;
  goal: string;
  status: 'active' | 'paused' | 'archived';
  cadence: string;
  maxClaimsPerRun: number;
  lastRunAt: string | null;
  createdAt: string;
}

interface AgentsResponse {
  agents: AgentSummary[];
}

function statusTone(status: string) {
  if (status === 'active') return 'text-emerald-300 border-emerald-400/20';
  if (status === 'paused') return 'text-orange-300 border-orange-400/20';
  return 'text-muted-foreground border-white/10';
}

export function MarketingAgentsPanel() {
  const { data, isLoading, error, refetch } = useApi<AgentsResponse>(
    '/api/marketing-agency/agents',
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const agents = data?.agents ?? [];

  return (
    <section className="rounded-sm border border-white/10 bg-white/[0.02] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Agentic loop
          </p>
          <h2 className="mt-2 text-lg font-semibold">Marketing Agents</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Autonomous agents that propose claims from the governed opportunities
            ledger, surface evidence gaps, and submit a QA report for human
            review. Agents never publish or bypass any gate.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="rounded-sm bg-white px-3 py-2 text-sm font-medium text-black hover:opacity-90"
        >
          + Create Agent
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-sm border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Could not load agents: {error.message}
        </div>
      )}

      {isLoading && !data && (
        <div className="mt-4 rounded-sm border border-white/10 px-4 py-4 text-sm text-muted-foreground">
          Loading agents…
        </div>
      )}

      {!isLoading && agents.length === 0 && !error && (
        <div className="mt-4 rounded-sm border border-white/10 px-4 py-4 text-sm text-muted-foreground">
          No agents yet. Create your first agent to start automating campaign
          legwork between gates.
        </div>
      )}

      {agents.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {agents.map((agent) => (
            <article
              key={agent.id}
              className="rounded-sm border border-white/10 bg-white/[0.02] p-4"
            >
              <header className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{agent.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {agent.goal}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-sm border px-2 py-0.5 text-xs ${statusTone(agent.status)}`}
                >
                  {agent.status}
                </span>
              </header>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <dt className="opacity-60">Last run</dt>
                  <dd>
                    {agent.lastRunAt
                      ? new Date(agent.lastRunAt).toLocaleString()
                      : 'Never'}
                  </dd>
                </div>
                <div>
                  <dt className="opacity-60">Max claims / run</dt>
                  <dd>{agent.maxClaimsPerRun}</dd>
                </div>
              </dl>

              <div className="mt-4 flex items-center gap-2">
                <RunAgentButton
                  agentId={agent.id}
                  disabled={agent.status !== 'active'}
                  onComplete={refetch}
                />
                <Link
                  href={`/dashboard/marketing-agency/agents/${agent.id}/runs`}
                  className="rounded-sm border border-white/10 px-3 py-1.5 text-xs hover:bg-white/[0.04]"
                >
                  View Runs
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <CreateAgentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => {
          setDialogOpen(false);
          refetch();
        }}
      />
    </section>
  );
}
