'use client';

/**
 * CreateAgentDialog — minimal modal form for creating a MarketingAgent.
 * Stays simple by design: name + goal + max claims/run. Cadence is shown
 * but locked to 'manual' until the queue-driven cadence ships in B.2.
 */
import { useState } from 'react';

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateAgentDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateAgentDialogProps) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [maxClaimsPerRun, setMaxClaimsPerRun] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/marketing-agency/agents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, goal, maxClaimsPerRun }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setName('');
      setGoal('');
      setMaxClaimsPerRun(5);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => !submitting && onOpenChange(false)}
    >
      <div
        className="w-full max-w-md rounded-sm border border-white/10 bg-black p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">Create Marketing Agent</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Agents run on the governed-opportunities ledger. They propose claims
          and surface evidence gaps — they never publish or bypass gates.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span>Name</span>
            <input
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="DR Daily Pulse"
              className="rounded-sm border border-white/10 bg-white/[0.02] px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span>Goal</span>
            <textarea
              required
              maxLength={2000}
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Grow Disaster Recovery's LinkedIn presence with weekly evidence-backed posts."
              className="rounded-sm border border-white/10 bg-white/[0.02] px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span>Max claims per run ({maxClaimsPerRun})</span>
            <input
              type="range"
              min={1}
              max={10}
              value={maxClaimsPerRun}
              onChange={(e) => setMaxClaimsPerRun(Number(e.target.value))}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span>Cadence</span>
            <select
              disabled
              value="manual"
              className="rounded-sm border border-white/10 bg-white/[0.02] px-3 py-2 text-sm opacity-60"
            >
              <option value="manual">Manual (Run Now)</option>
            </select>
            <span className="text-xs opacity-60">
              Scheduled cadences (daily, weekly) coming in a follow-up.
            </span>
          </label>

          {error && (
            <div className="rounded-sm border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="rounded-sm border border-white/10 px-3 py-2 text-sm hover:bg-white/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name || !goal}
              className="rounded-sm bg-white px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
