'use client';

/**
 * ExecutionDetail — Slide-in detail panel for a single workflow execution.
 * Shows metadata, step timeline, approval actions, and cancel button.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, ChevronRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { StepTimeline } from './StepTimeline';
import { ApprovalActions } from './ApprovalActions';
import type {
  WorkflowExecutionWithSteps,
  StepExecution,
} from '@/lib/workflow/hooks/use-workflow-executions';

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; border: string; label: string }> = {
    pending: {
      bg: 'bg-gray-500/20',
      text: 'text-gray-400',
      border: 'border-gray-500/30',
      label: 'Pending',
    },
    running: {
      bg: 'bg-blue-500/20',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
      label: 'Running',
    },
    waiting_approval: {
      bg: 'bg-amber-500/20',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      label: 'Awaiting Approval',
    },
    completed: {
      bg: 'bg-green-500/20',
      text: 'text-green-400',
      border: 'border-green-500/30',
      label: 'Completed',
    },
    failed: {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      border: 'border-red-500/30',
      label: 'Failed',
    },
    cancelled: {
      bg: 'bg-gray-600/20',
      text: 'text-gray-500',
      border: 'border-gray-600/30',
      label: 'Cancelled',
    },
  };

  const { bg, text, border, label } = cfg[status] ?? cfg['pending'];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        bg,
        text,
        border,
        status === 'running' && 'animate-pulse'
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Metadata row
// ---------------------------------------------------------------------------

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-gray-500 min-w-[100px]">{label}</span>
      <span className="text-gray-200">{value}</span>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExecutionDetailProps {
  execution: WorkflowExecutionWithSteps;
  onClose: () => void;
  onRefresh: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExecutionDetail({
  execution,
  onClose,
  onRefresh,
  className,
}: ExecutionDetailProps) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const canCancel =
    execution.status === 'running' || execution.status === 'waiting_approval';

  // Steps awaiting approval
  const waitingSteps: StepExecution[] = (execution.stepExecutions ?? []).filter(
    (s) => s.status === 'waiting_approval'
  );

  // -------------------------------------------------------------------------
  // Cancel execution
  // -------------------------------------------------------------------------

  async function handleCancel() {
    if (!window.confirm('Cancel this workflow execution? This cannot be undone.')) return;
    setCancelError(null);
    setCancelling(true);
    try {
      const res = await fetch(`/api/workflows/executions/${execution.id}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by user' }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Cancel failed (${res.status})`);
      }
      onRefresh();
      onClose();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Cancellation failed');
    } finally {
      setCancelling(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/10">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-white truncate">{execution.title}</h2>
            <StatusBadge status={execution.status} />
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <ChevronRight className="h-3 w-3" />
            <span className="capitalize">{execution.triggerType} trigger</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="shrink-0 text-gray-500 hover:text-white rounded-md p-1 hover:bg-white/5 transition-colors"
          aria-label="Close detail panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Metadata */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Details</h3>
          <div className="space-y-1.5">
            <MetaRow label="Started" value={formatDate(execution.startedAt)} />
            {execution.completedAt && (
              <MetaRow label="Completed" value={formatDate(execution.completedAt)} />
            )}
            <MetaRow
              label="Progress"
              value={`${execution.currentStepIndex} / ${execution.totalSteps} steps`}
            />
            {execution.errorMessage && (
              <div className="mt-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
                <p className="text-xs text-red-400">{execution.errorMessage}</p>
              </div>
            )}
          </div>
        </section>

        {/* Approval actions — rendered before timeline for visibility */}
        {waitingSteps.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-amber-500 uppercase tracking-wide">
              Pending Approvals ({waitingSteps.length})
            </h3>
            <div className="space-y-2">
              {waitingSteps.map((step) => (
                <div key={step.id} className="space-y-1">
                  <p className="text-xs text-gray-400">
                    Step {step.stepIndex + 1}: <strong className="text-white">{step.stepName}</strong>
                  </p>
                  <ApprovalActions
                    executionId={execution.id}
                    stepId={step.id}
                    onApproved={onRefresh}
                    onRejected={() => { onRefresh(); onClose(); }}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Step timeline */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Steps ({execution.stepExecutions?.length ?? 0})
          </h3>
          <StepTimeline steps={execution.stepExecutions ?? []} />
        </section>
      </div>

      {/* Footer — cancel button */}
      {canCancel && (
        <div className="px-5 py-3 border-t border-white/10">
          {cancelError && (
            <p className="text-xs text-red-400 mb-2">{cancelError}</p>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={cancelling}
            onClick={handleCancel}
            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30"
          >
            {cancelling ? (
              <span className="h-3 w-3 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin mr-1.5" />
            ) : null}
            Cancel Workflow
          </Button>
        </div>
      )}
    </div>
  );
}
