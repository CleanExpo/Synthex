'use client';

/**
 * ClaimActions — Approve / Reject buttons for a single proposed Claim.
 *
 * Used inline in `AgentRunDetail.tsx` for each item in the run artifacts'
 * claims[] list. Posts to `/api/marketing-agency/claims/[id]/action`
 * through the project's shared `useMutation` hook (per CodeRabbit
 * finding — bypassing the hooks layer creates inconsistent error/retry
 * semantics across the codebase).
 *
 * UX: Approve is one-click; Reject opens an inline comment input (server
 * requires a non-whitespace comment for rejection — SYN-977).
 */
import { useState } from 'react';
import { useMutation } from '@/hooks/use-api';

interface ClaimActionsProps {
  claimId: string;
  onActionComplete?: () => void;
}

interface ClaimActionResponse {
  claim: { id: string; evidenceStatus: string; statement: string };
  action: 'approve' | 'reject';
}

async function postClaimAction(input: {
  claimId: string;
  action: 'approve' | 'reject';
  comment?: string;
}): Promise<ClaimActionResponse> {
  const res = await fetch(
    `/api/marketing-agency/claims/${encodeURIComponent(input.claimId)}/action`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: input.action, comment: input.comment }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<ClaimActionResponse>;
}

export function ClaimActions({ claimId, onActionComplete }: ClaimActionsProps) {
  const [askingReason, setAskingReason] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  const mutation = useMutation<
    ClaimActionResponse,
    { action: 'approve' | 'reject'; comment?: string }
  >(
    (variables) => postClaimAction({ claimId, ...variables }),
    {
      onSuccess: () => {
        setAskingReason(false);
        setRejectComment('');
        onActionComplete?.();
      },
    },
  );

  if (mutation.data) {
    return (
      <p className="mt-2 text-xs text-emerald-300">
        Claim {mutation.data.action === 'approve' ? 'approved' : 'rejected'} →{' '}
        {mutation.data.claim.evidenceStatus}
      </p>
    );
  }

  if (askingReason) {
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
            disabled={rejectComment.trim().length === 0 || mutation.isLoading}
            onClick={() =>
              mutation.mutate({ action: 'reject', comment: rejectComment.trim() })
            }
          >
            {mutation.isLoading ? 'Rejecting…' : 'Confirm reject'}
          </button>
          <button
            type="button"
            className="rounded-sm border border-white/10 px-3 py-1 text-xs hover:bg-white/[0.04]"
            onClick={() => {
              setAskingReason(false);
              setRejectComment('');
            }}
          >
            Cancel
          </button>
        </div>
        {mutation.error && (
          <span className="text-xs text-red-300">{mutation.error.message}</span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        className="rounded-sm bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
        disabled={mutation.isLoading}
        onClick={() => mutation.mutate({ action: 'approve' })}
      >
        {mutation.isLoading ? 'Approving…' : 'Approve'}
      </button>
      <button
        type="button"
        className="rounded-sm bg-red-500/20 px-3 py-1 text-xs font-medium text-red-200 hover:bg-red-500/30 disabled:opacity-50"
        disabled={mutation.isLoading}
        onClick={() => setAskingReason(true)}
      >
        Reject
      </button>
      {mutation.error && (
        <span className="text-xs text-red-300">{mutation.error.message}</span>
      )}
    </div>
  );
}
