'use client'

/**
 * ParallelExecutionWidget — Phase 63
 * Shows concurrent execution slot usage and progress bars for active executions.
 */

import { cn } from '@/lib/utils'
import { GitBranch, Loader2 } from '@/components/icons'
import Link from 'next/link'
import type { WorkflowExecution } from '@/lib/workflow/hooks/use-workflow-executions'

const MAX_CONCURRENCY = 5

interface ParallelExecutionWidgetProps {
  executions: WorkflowExecution[]
  className?: string
}

function statusColour(status: string): string {
  switch (status) {
    case 'running': return 'bg-cyan-500'
    case 'waiting_approval': return 'bg-amber-500'
    case 'completed': return 'bg-emerald-500'
    case 'failed': return 'bg-rose-500'
    case 'cancelled': return 'bg-slate-500'
    default: return 'bg-slate-400'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'running': return 'Running'
    case 'waiting_approval': return 'Awaiting Review'
    case 'completed': return 'Done'
    case 'failed': return 'Failed'
    case 'cancelled': return 'Cancelled'
    default: return 'Pending'
  }
}

export function ParallelExecutionWidget({ executions, className }: ParallelExecutionWidgetProps) {
  const active = executions.filter((e) =>
    ['pending', 'running', 'waiting_approval'].includes(e.status)
  )

  if (active.length <= 1) return null

  const usedSlots = Math.min(active.length, MAX_CONCURRENCY)
  const slotPct = Math.round((usedSlots / MAX_CONCURRENCY) * 100)

  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-white/5 p-4 space-y-3',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
          <span className="text-sm font-medium text-white/90">Parallel Executions</span>
        </div>
        <span className="text-xs text-white/50">
          {usedSlots} / {MAX_CONCURRENCY} slots
        </span>
      </div>

      {/* Overall slot bar */}
      <div className="space-y-1">
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-cyan-500 transition-all duration-500"
            style={{ width: `${slotPct}%` }}
          />
        </div>
        <p className="text-xs text-white/40">
          {usedSlots === MAX_CONCURRENCY
            ? 'At maximum concurrency'
            : `${MAX_CONCURRENCY - usedSlots} slot${MAX_CONCURRENCY - usedSlots !== 1 ? 's' : ''} available`}
        </p>
      </div>

      {/* Per-execution progress bars */}
      <div className="space-y-2">
        {active.slice(0, 5).map((exec) => {
          const pct =
            exec.totalSteps > 0
              ? Math.round((exec.currentStepIndex / exec.totalSteps) * 100)
              : 0

          return (
            <div key={exec.id} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/60 truncate max-w-[200px]">{exec.title}</span>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full border',
                    exec.status === 'running' && 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
                    exec.status === 'waiting_approval' && 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                    exec.status === 'pending' && 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                  )}
                >
                  {statusLabel(exec.status)}
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn('h-full transition-all duration-500', statusColour(exec.status))}
                  style={{ width: exec.status === 'waiting_approval' ? '100%' : `${Math.max(pct, 5)}%` }}
                />
              </div>
            </div>
          )
        })}
        {active.length > 5 && (
          <p className="text-xs text-white/40">+{active.length - 5} more running…</p>
        )}
      </div>

      {/* CTA */}
      <Link
        href="/dashboard/workflows"
        className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colours"
      >
        <GitBranch className="h-3 w-3" />
        View all workflows
      </Link>
    </div>
  )
}
