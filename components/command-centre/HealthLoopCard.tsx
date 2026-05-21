'use client';

import { Activity, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AutopilotStatus } from './types';

type CloseLoopHealth = NonNullable<AutopilotStatus['closeLoopHealth']>;

interface Props {
  health: CloseLoopHealth | null;
}

const OVERALL_COPY = {
  green: {
    label: 'Healthy',
    tone: 'text-emerald-300',
    dot: 'bg-emerald-400',
    border: 'border-emerald-400/20',
  },
  yellow: {
    label: 'Needs review',
    tone: 'text-orange-300',
    dot: 'bg-orange-400',
    border: 'border-orange-400/20',
  },
  red: {
    label: 'Blocked',
    tone: 'text-red-300',
    dot: 'bg-red-400',
    border: 'border-red-400/20',
  },
} as const;

function formatRelative(value: string | null) {
  if (!value) return 'No run';

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(0, Math.round(diffMs / 36e5));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;

  return `${Math.round(diffHours / 24)}d ago`;
}

function pipelineTone(status: string, stale: boolean) {
  if (status === 'success' && !stale) return 'text-emerald-300';
  if (status === 'partial' && !stale) return 'text-orange-300';
  return 'text-red-300';
}

export function HealthLoopCard({ health }: Props) {
  const overall = health?.overall ?? 'yellow';
  const copy = OVERALL_COPY[overall];
  const healthyCount =
    health?.pipelines.filter(p => p.status === 'success' && !p.stale).length ??
    0;
  const totalCount = health?.pipelines.length ?? 0;

  return (
    <section
      className={cn(
        'border-[0.5px] bg-white/[0.02] rounded-sm p-5',
        copy.border
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', copy.dot)} />
            <p className="text-xs uppercase tracking-widest text-white/45">
              Health Loop
            </p>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Activity className={cn('h-5 w-5', copy.tone)} />
            <h2 className="text-lg font-semibold text-white">
              {copy.label}
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Evidence chain for Wiki, Linear, CI, runtime jobs, and learning-loop
            pipelines.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:min-w-[260px]">
          <div className="border-[0.5px] border-white/[0.06] rounded-sm px-4 py-3">
            <div className="flex items-center gap-2 text-white/45">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-[11px] uppercase tracking-widest">
                Clear
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-white">
              {healthyCount}/{totalCount}
            </p>
          </div>
          <div className="border-[0.5px] border-white/[0.06] rounded-sm px-4 py-3">
            <div className="flex items-center gap-2 text-white/45">
              <Clock3 className="h-4 w-4" />
              <span className="text-[11px] uppercase tracking-widest">
                Checked
              </span>
            </div>
            <p className="mt-2 text-sm font-medium text-white">
              {health ? formatRelative(health.checkedAt) : 'Pending'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        {(health?.pipelines ?? []).map(pipeline => (
          <div
            key={pipeline.name}
            className="border-[0.5px] border-white/[0.06] rounded-sm px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="truncate text-sm font-medium text-white/80">
                {pipeline.name}
              </p>
              <span
                className={cn(
                  'text-xs font-medium',
                  pipelineTone(pipeline.status, pipeline.stale)
                )}
              >
                {pipeline.stale ? 'stale' : pipeline.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-white/40">
              Last run {formatRelative(pipeline.lastRunAt)}
            </p>
          </div>
        ))}
      </div>

      {!health && (
        <div className="mt-5 flex items-center gap-2 text-sm text-orange-300/80">
          <ShieldAlert className="h-4 w-4" />
          Health Loop evidence is waiting for the first runtime read.
        </div>
      )}
    </section>
  );
}
