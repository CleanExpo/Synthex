'use client';

/**
 * OutcomeWorkbench — outcome-first entry for the Marketing Agency (SYN-1029).
 *
 * The operator types or picks a business outcome and Synthex does the operator
 * work behind the scenes: it reuses an existing active agent that already
 * targets the outcome, or creates a sensible agent draft, then runs the first
 * work package. The surface shows exactly one next action — "Review prepared
 * work" — instead of a list of agents, runs, and gates.
 *
 * It only calls the existing governed endpoints
 * (`/api/marketing-agency/agents` and `/agents/[id]/run`), so every gate is
 * preserved: tier limits return 402, and a run only proposes claims and writes
 * a blocked QA report — no publishing or credential gate is bypassed.
 */
import { useState } from 'react';
import Link from 'next/link';

const PRESET_OUTCOMES = [
  'Launch RestoreAssist',
  'Build CARSI authority',
] as const;

interface AgentSummary {
  id: string;
  name: string;
  goal: string;
  status: string;
}

type WorkbenchState =
  | { phase: 'idle' }
  | { phase: 'working'; outcome: string }
  | {
      phase: 'ready';
      outcome: string;
      runId: string;
      reused: boolean;
    }
  | { phase: 'error'; outcome: string; message: string };

function goalForOutcome(outcome: string): string {
  return `Drive marketing work toward the outcome: ${outcome}. Propose governed claims and surface evidence gaps for human review. Publishing stays human-approved.`;
}

/** Reuse an active agent already aimed at this outcome, or create a draft. */
async function resolveAgent(
  outcome: string
): Promise<{ id: string; reused: boolean }> {
  const listRes = await fetch('/api/marketing-agency/agents');
  if (!listRes.ok) {
    throw new Error(`Could not load existing agents (${listRes.status})`);
  }
  const { agents = [] } = (await listRes.json()) as { agents?: AgentSummary[] };

  const needle = outcome.toLowerCase();
  const match = agents.find(
    a =>
      a.status === 'active' &&
      (a.name.toLowerCase() === needle ||
        a.goal.toLowerCase().includes(needle))
  );
  if (match) return { id: match.id, reused: true };

  const createRes = await fetch('/api/marketing-agency/agents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: outcome.slice(0, 120),
      goal: goalForOutcome(outcome),
      maxClaimsPerRun: 5,
    }),
  });
  if (!createRes.ok) {
    const body = (await createRes.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? `Could not create a worker (${createRes.status})`);
  }
  const { agent } = (await createRes.json()) as { agent: { id: string } };
  return { id: agent.id, reused: false };
}

async function runFirstWorkPackage(agentId: string): Promise<string> {
  const res = await fetch(`/api/marketing-agency/agents/${agentId}/run`, {
    method: 'POST',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Could not start the work (${res.status})`);
  }
  const data = (await res.json()) as { run?: { id?: string } };
  if (!data.run?.id) throw new Error('Work started but no run was returned.');
  return data.run.id;
}

export function OutcomeWorkbench() {
  const [goalText, setGoalText] = useState('');
  const [state, setState] = useState<WorkbenchState>({ phase: 'idle' });

  async function startOutcome(rawOutcome: string) {
    const outcome = rawOutcome.trim();
    if (!outcome) return;
    setState({ phase: 'working', outcome });
    try {
      const { id, reused } = await resolveAgent(outcome);
      const runId = await runFirstWorkPackage(id);
      setState({ phase: 'ready', outcome, runId, reused });
    } catch (err) {
      setState({
        phase: 'error',
        outcome,
        message: err instanceof Error ? err.message : 'Could not prepare work.',
      });
    }
  }

  const busy = state.phase === 'working';

  return (
    <section className="rounded-sm border border-white/10 bg-white/[0.02] p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Start with an outcome
      </p>
      <h2 className="mt-2 text-lg font-semibold">What should Synthex work on?</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Name a business outcome. Synthex prepares the right worker and a first
        draft of work for your review — no agents, runs, or gates to wire up
        yourself.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {PRESET_OUTCOMES.map(outcome => (
          <button
            key={outcome}
            type="button"
            disabled={busy}
            onClick={() => startOutcome(outcome)}
            className="rounded-sm border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm hover:bg-white/[0.06] disabled:opacity-50"
          >
            {outcome}
          </button>
        ))}
      </div>

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={e => {
          e.preventDefault();
          startOutcome(goalText);
        }}
      >
        <input
          aria-label="Business outcome"
          value={goalText}
          onChange={e => setGoalText(e.target.value)}
          disabled={busy}
          placeholder="e.g. Win more disaster-recovery enquiries this quarter"
          className="flex-1 rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !goalText.trim()}
          className="rounded-sm bg-emerald-400 px-4 py-2 text-sm font-medium text-emerald-950 hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Preparing…' : 'Prepare work'}
        </button>
      </form>

      {state.phase === 'working' && (
        <p className="mt-4 text-sm text-muted-foreground">
          Preparing work for <span className="text-white">{state.outcome}</span>…
        </p>
      )}

      {state.phase === 'ready' && (
        <div className="mt-4 rounded-sm border border-emerald-400/30 bg-emerald-950/20 px-4 py-3">
          <p className="text-sm text-emerald-100">
            Synthex {state.reused ? 'queued new work' : 'set up a worker and queued the first work'}{' '}
            for <span className="font-medium">{state.outcome}</span>.
          </p>
          <Link
            href={`/dashboard/marketing-agency/runs/${state.runId}`}
            className="mt-3 inline-flex rounded-sm bg-emerald-300 px-4 py-2 text-sm font-medium text-emerald-950"
          >
            Review prepared work
          </Link>
        </div>
      )}

      {state.phase === 'error' && (
        <div className="mt-4 rounded-sm border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {state.message}
        </div>
      )}
    </section>
  );
}
