'use client';

/**
 * ApprovalActions — Approve or reject a workflow step awaiting human review.
 * Approve calls POST /api/workflows/executions/[id]/approve with { stepId }.
 * Reject shows a reason textarea then calls POST /api/workflows/executions/[id]/cancel.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X } from '@/components/icons';
import { cn } from '@/lib/utils';

interface ApprovalActionsProps {
  executionId: string;
  stepId: string;
  onApproved: () => void;
  onRejected: () => void;
  className?: string;
}

type Phase = 'idle' | 'rejecting';

export function ApprovalActions({
  executionId,
  stepId,
  onApproved,
  onRejected,
  className,
}: ApprovalActionsProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [rejectReason, setRejectReason] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Approve
  // -------------------------------------------------------------------------

  async function handleApprove() {
    setError(null);
    setApproving(true);
    try {
      const res = await fetch(`/api/workflows/executions/${executionId}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Approve failed (${res.status})`);
      }
      onApproved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setApproving(false);
    }
  }

  // -------------------------------------------------------------------------
  // Reject (two-phase: show textarea → submit)
  // -------------------------------------------------------------------------

  function handleRejectClick() {
    setPhase('rejecting');
    setError(null);
  }

  async function handleRejectConfirm() {
    setError(null);
    setRejecting(true);
    try {
      const res = await fetch(`/api/workflows/executions/${executionId}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason || 'Rejected by reviewer' }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Reject failed (${res.status})`);
      }
      onRejected();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setRejecting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      className={cn(
        'rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-3 space-y-3',
        className
      )}
    >
      <p className="text-xs font-medium text-amber-400 uppercase tracking-wide">
        Awaiting your approval
      </p>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
          {error}
        </p>
      )}

      {phase === 'idle' && (
        <div className="flex gap-2">
          {/* Approve */}
          <Button
            size="sm"
            disabled={approving}
            onClick={handleApprove}
            className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 hover:border-green-400/50"
          >
            {approving ? (
              <span className="h-3 w-3 rounded-full border-2 border-green-400/30 border-t-green-400 animate-spin mr-1.5" />
            ) : (
              <Check className="h-3.5 w-3.5 mr-1.5" />
            )}
            Approve
          </Button>

          {/* Reject */}
          <Button
            size="sm"
            disabled={approving}
            variant="outline"
            onClick={handleRejectClick}
            className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-400/50"
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Reject
          </Button>
        </div>
      )}

      {phase === 'rejecting' && (
        <div className="space-y-2">
          <textarea
            autoFocus
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            className="w-full rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-500 px-2 py-1.5 resize-none focus:outline-none focus:border-red-500/50"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={rejecting}
              onClick={handleRejectConfirm}
              className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
            >
              {rejecting ? (
                <span className="h-3 w-3 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin mr-1.5" />
              ) : (
                <X className="h-3.5 w-3.5 mr-1.5" />
              )}
              Confirm Reject
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={rejecting}
              onClick={() => { setPhase('idle'); setRejectReason(''); setError(null); }}
              className="text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
