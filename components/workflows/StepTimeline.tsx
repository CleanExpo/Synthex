'use client';

/**
 * StepTimeline — Vertical timeline of workflow step executions.
 * Shows step type icon, name, status colour, and confidence badge.
 * Running steps pulse; failed steps show error message.
 */

import { cn } from '@/lib/utils';
import { Brain, User, Zap, CheckCircle } from '@/components/icons';
import { ConfidenceBadge } from './ConfidenceBadge';
import type { StepExecution } from '@/lib/workflow/hooks/use-workflow-executions';

// ---------------------------------------------------------------------------
// Step type → icon mapping
// ---------------------------------------------------------------------------

function StepIcon({ stepType, className }: { stepType: string; className?: string }) {
  switch (stepType) {
    case 'ai':
      return <Brain className={cn('h-4 w-4', className)} />;
    case 'approval':
      return <User className={cn('h-4 w-4', className)} />;
    case 'action':
      return <Zap className={cn('h-4 w-4', className)} />;
    case 'validation':
      return <CheckCircle className={cn('h-4 w-4', className)} />;
    default:
      return <Zap className={cn('h-4 w-4', className)} />;
  }
}

// ---------------------------------------------------------------------------
// Status colour helper
// ---------------------------------------------------------------------------

function statusColour(status: string): {
  dot: string;
  label: string;
  text: string;
} {
  switch (status) {
    case 'pending':
      return { dot: 'bg-gray-500', label: 'Pending', text: 'text-gray-400' };
    case 'running':
      return { dot: 'bg-blue-500 animate-pulse', label: 'Running', text: 'text-blue-400' };
    case 'completed':
      return { dot: 'bg-green-500', label: 'Completed', text: 'text-green-400' };
    case 'failed':
      return { dot: 'bg-red-500', label: 'Failed', text: 'text-red-400' };
    case 'skipped':
      return { dot: 'bg-gray-600', label: 'Skipped', text: 'text-gray-500' };
    case 'waiting_approval':
      return { dot: 'bg-amber-500', label: 'Awaiting Approval', text: 'text-amber-400' };
    default:
      return { dot: 'bg-gray-500', label: status, text: 'text-gray-400' };
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StepTimelineProps {
  steps: StepExecution[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepTimeline({ steps, className }: StepTimelineProps) {
  if (!steps.length) {
    return (
      <p className="text-sm text-gray-500 italic py-4 text-center">No steps recorded yet.</p>
    );
  }

  const sorted = [...steps].sort((a, b) => a.stepIndex - b.stepIndex);

  return (
    <ol className={cn('relative', className)}>
      {sorted.map((step, idx) => {
        const { dot, label, text } = statusColour(step.status);
        const isLast = idx === sorted.length - 1;

        return (
          <li key={step.id} className="relative pl-8 pb-6">
            {/* Vertical connector line */}
            {!isLast && (
              <span
                className="absolute left-[11px] top-5 h-full w-px bg-white/10"
                aria-hidden="true"
              />
            )}

            {/* Step dot */}
            <span
              className={cn(
                'absolute left-0 top-1 h-6 w-6 rounded-full border border-white/10 flex items-center justify-center',
                step.status === 'running' ? 'bg-blue-500/20' : 'bg-white/5'
              )}
            >
              <span className={cn('h-2.5 w-2.5 rounded-full', dot)} />
            </span>

            {/* Step content */}
            <div className="flex flex-col gap-0.5">
              {/* Header row */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Step type icon */}
                <span className="text-gray-500">
                  <StepIcon stepType={step.stepType} />
                </span>

                {/* Step name */}
                <span className="text-sm font-medium text-white">
                  {step.stepName}
                </span>

                {/* Status label */}
                <span className={cn('text-xs font-medium', text)}>{label}</span>

                {/* Confidence badge */}
                <ConfidenceBadge score={step.confidenceScore} />

                {/* Auto-approved indicator */}
                {step.autoApproved && (
                  <span className="text-[10px] text-gray-500 italic">auto-approved</span>
                )}
              </div>

              {/* Step type caption */}
              <span className="text-[11px] text-gray-600 capitalize">
                {step.stepType} step · #{step.stepIndex + 1}
              </span>

              {/* Timing */}
              {step.completedAt && step.startedAt && (
                <span className="text-[11px] text-gray-600">
                  {Math.round(
                    (new Date(step.completedAt).getTime() -
                      new Date(step.startedAt).getTime()) /
                      1000
                  )}
                  s
                </span>
              )}

              {/* Error message */}
              {step.status === 'failed' && step.errorMessage && (
                <div className="mt-1 rounded-md bg-red-500/10 border border-red-500/20 px-2 py-1">
                  <p className="text-xs text-red-400 break-words">{step.errorMessage}</p>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
