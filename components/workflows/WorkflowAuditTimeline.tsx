'use client';

/**
 * WorkflowAuditTimeline — renders the decision audit trail for a workflow
 * execution (SYN-972 Audit leg). Reads GET /api/workflows/executions/[id]/audit
 * and shows who approved/rejected each step, when, and why — the founder's
 * "what did the agency OS do?" view.
 */
import { useEffect, useState } from 'react';

interface AuditEntry {
  stepIndex: number;
  stepName: string;
  stepType: string;
  outcome:
    | 'auto_approved'
    | 'approved'
    | 'rejected'
    | 'failed'
    | 'awaiting_approval'
    | 'skipped'
    | 'in_progress';
  actor?: string;
  at?: string;
  detail?: string;
}

const OUTCOME_META: Record<
  AuditEntry['outcome'],
  { label: string; className: string }
> = {
  auto_approved: { label: 'Auto-approved', className: 'text-emerald-300 border-emerald-400/30' },
  approved: { label: 'Approved', className: 'text-emerald-300 border-emerald-400/30' },
  rejected: { label: 'Sent for revision', className: 'text-red-300 border-red-400/30' },
  failed: { label: 'Failed', className: 'text-red-300 border-red-400/30' },
  awaiting_approval: { label: 'Awaiting approval', className: 'text-orange-300 border-orange-400/30' },
  skipped: { label: 'Skipped', className: 'text-gray-400 border-white/10' },
  in_progress: { label: 'In progress', className: 'text-sky-300 border-sky-400/30' },
};

function formatAt(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}

export function WorkflowAuditTimeline({ executionId }: { executionId: string }) {
  const [trail, setTrail] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/workflows/executions/${executionId}/audit`, {
      credentials: 'include',
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Audit unavailable (${r.status})`);
        return r.json();
      })
      .then((json) => {
        if (!cancelled) setTrail(json?.trail ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load audit');
      });
    return () => {
      cancelled = true;
    };
  }, [executionId]);

  if (error) {
    return <p className="text-xs text-red-300">{error}</p>;
  }
  if (trail === null) {
    return <p className="text-xs text-gray-500">Loading audit trail…</p>;
  }
  if (trail.length === 0) {
    return <p className="text-xs text-gray-500">No decisions recorded yet.</p>;
  }

  return (
    <ol className="space-y-1.5">
      {trail.map((e) => {
        const meta = OUTCOME_META[e.outcome];
        const at = formatAt(e.at);
        return (
          <li
            key={e.stepIndex}
            className="flex items-start justify-between gap-3 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm text-white">{e.stepName}</p>
              {e.detail && (
                <p className="mt-0.5 text-xs text-amber-200/80">{e.detail}</p>
              )}
              {(e.actor || at) && (
                <p className="mt-0.5 text-xs text-gray-500">
                  {e.actor ? `by ${e.actor}` : ''}
                  {e.actor && at ? ' · ' : ''}
                  {at ?? ''}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 rounded-sm border px-2 py-0.5 text-xs ${meta.className}`}
            >
              {meta.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
