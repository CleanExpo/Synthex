'use client';

/**
 * ExecutionList — Renders a list of WorkflowExecution summary cards.
 * Clicking a card calls onSelect(execution).
 * Selected card is highlighted.
 */

import { cn } from '@/lib/utils';
import type { WorkflowExecution } from '@/lib/workflow/hooks/use-workflow-executions';

// ---------------------------------------------------------------------------
// Status badge config
// ---------------------------------------------------------------------------

type StatusConfig = {
  bg: string;
  text: string;
  border: string;
  label: string;
  pulse?: boolean;
};

const STATUS_CONFIG: Record<string, StatusConfig> = {
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
    pulse: true,
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

function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG['pending'];
}

function StatusBadge({ status }: { status: string }) {
  const { bg, text, border, label, pulse } = getStatusConfig(status);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        bg,
        text,
        border,
        pulse && 'animate-pulse'
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Trigger type label
// ---------------------------------------------------------------------------

function triggerLabel(triggerType: string): string {
  switch (triggerType) {
    case 'manual':
      return 'Manual';
    case 'scheduled':
      return 'Scheduled';
    case 'api':
      return 'API';
    default:
      return triggerType;
  }
}

// ---------------------------------------------------------------------------
// Date formatter
// ---------------------------------------------------------------------------

function formatRelative(iso: string | null): string {
  if (!iso) return 'Not started';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Execution card
// ---------------------------------------------------------------------------

function ExecutionCard({
  execution,
  selected,
  onClick,
}: {
  execution: WorkflowExecution;
  selected: boolean;
  onClick: () => void;
}) {
  const progress =
    execution.totalSteps > 0
      ? Math.round((execution.currentStepIndex / execution.totalSteps) * 100)
      : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border px-4 py-3 transition-all duration-150',
        'bg-white/[0.03] hover:bg-white/[0.06]',
        selected
          ? 'border-cyan-500/50 ring-1 ring-cyan-500/30 bg-cyan-500/5'
          : 'border-white/10 hover:border-white/20'
      )}
    >
      {/* Title + status row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-white line-clamp-1 flex-1">{execution.title}</p>
        <StatusBadge status={execution.status} />
      </div>

      {/* Progress bar */}
      {execution.totalSteps > 0 && (
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
            <span>Step {execution.currentStepIndex}/{execution.totalSteps}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-2 text-[11px] text-gray-500">
        <span className="capitalize">{triggerLabel(execution.triggerType)}</span>
        <span>·</span>
        <span>{formatRelative(execution.startedAt ?? execution.createdAt)}</span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExecutionListProps {
  executions: WorkflowExecution[];
  onSelect: (exec: WorkflowExecution) => void;
  selectedId: string | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExecutionList({
  executions,
  onSelect,
  selectedId,
  className,
}: ExecutionListProps) {
  if (!executions.length) {
    return (
      <div className={cn('py-8 text-center', className)}>
        <p className="text-sm text-gray-500">No executions found.</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {executions.map((exec) => (
        <ExecutionCard
          key={exec.id}
          execution={exec}
          selected={exec.id === selectedId}
          onClick={() => onSelect(exec)}
        />
      ))}
    </div>
  );
}
