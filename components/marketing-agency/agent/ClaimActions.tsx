'use client';

/**
 * ClaimActions — Approve / Reject buttons for a single proposed Claim.
 *
 * Used inline in `AgentRunDetail.tsx` for each item in the run artifacts'
 * claims[] list. Posts to `/api/marketing-agency/claims/[id]/action`.
 *
 * UX: Approve is one-click; Reject opens an inline comment input (server
 * requires a comment for rejection — SYN-977).
 */
import { useState } from 'react';

interface ClaimActionsProps {
  claimId: string;
  onActionComplete?: () => void;
}

type ActionState =
  | { kind: 'idle' }
  | { kind: 'asking-reject-reason' }
  | { kind: 'submitting'; action: 'approve' | 'reject' }
  | { kind: 'done'; action: 'approve' | 'reject'; newStatus: string }
  | { kind: 'error'; message: string };

export function ClaimActions({ claimId, onActionComplete }: ClaimActionsProps) {
  const [state, setState] = useState<ActionState>({ kind: 'idle' });
  const [rejectComment, setRejectComment] = useState('');

  async function postAction(action: 'approve' | 'reject', comment?: string) {
    setState({ kind: 'submitting', action });
    try {
      const res = await fetch(
        `/api/marketing-agency/claims/${encodeURIComponent(claimId)}/action`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, comment }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as { claim: { evidenceStatus: string } };
      setState({ kind: 'done', action, newStatus: data.claim.evidenceStatus });
      setRejectComment('');
      onActionComplete?.();
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Failed' });
    }
  }

  if (state.kind === 'done') {
    return (
      <p className="mt-2 text-xs text-emerald-300">
        Claim {state.action === 'approve' ? 'approved' : 'rejected'} → {state.newStatus}
      </p>
    );
  }

  if (state.kind === 'asking-reject-reason') {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <textarea
          value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
          placeholder="Why are you rejecting this claim?"
          rows={2}
          maxLength={2000}
          className="rounded-sm border border-white/10 bg-white/[0.02] px-2 py-1 text-xs"
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-sm bg-red-500/20 px-3 py-1 text-xs font-medium text-red-200 hover:bg-red-500/30 disabled:opacity-50"
            disabled={rejectComment.trim().length === 0}
            onClick={() => postAction('reject', rejectComment.trim())}
          >
            Confirm reject
          </button>
          <button
            type="button"
            className="rounded-sm border border-white/10 px-3 py-1 text-xs hover:bg-white/[0.04]"
            onClick={() => setState({ kind: 'idle' })}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const submitting = state.kind === 'submitting';

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        className="rounded-sm bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
        disabled={submitting}
        onClick={() => postAction('approve')}
      >
        {submitting && state.action === 'approve' ? 'Approving…' : 'Approve'}
      </button>
      <button
        type="button"
        className="rounded-sm bg-red-500/20 px-3 py-1 text-xs font-medium text-red-200 hover:bg-red-500/30 disabled:opacity-50"
        disabled={submitting}
        onClick={() => setState({ kind: 'asking-reject-reason' })}
      >
        Reject
      </button>
      {state.kind === 'error' && (
        <span className="text-xs text-red-300">{state.message}</span>
      )}
    </div>
  );
}
