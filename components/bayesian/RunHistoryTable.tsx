'use client';

import { Brain, CheckCircle, AlertCircle, Clock } from '@/components/icons';
import { SURFACE_LABELS } from './surface-labels';

type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface BORunData {
  id: string;
  spaceId: string;
  status: RunStatus;
  nIterations: number;
  currentIteration: number;
  bestTarget: number | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  space: { surface: string; name: string | null };
}

interface RunHistoryTableProps {
  runs: BORunData[];
  isLoading?: boolean;
}

const STATUS_STYLES: Record<RunStatus, string> = {
  pending:   'bg-gray-500/20 text-gray-400',
  running:   'bg-amber-500/20 text-amber-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  failed:    'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
};

const STATUS_ICONS: Record<RunStatus, React.ComponentType<{ className?: string }>> = {
  pending:   Clock,
  running:   Brain,
  completed: CheckCircle,
  failed:    AlertCircle,
  cancelled: Clock,
};

function formatSurface(surface: string): string {
  return (SURFACE_LABELS as Record<string, string>)[surface] ?? surface
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return '—';
  const diffMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const secs = Math.floor(diffMs / 1_000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Table showing an organisation's past Bayesian Optimisation runs.
 */
export function RunHistoryTable({ runs, isLoading = false }: RunHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse bg-white/5 rounded-lg"
          />
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Brain className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No optimisation runs yet</p>
        <p className="text-xs mt-1">Trigger a run from an optimisation space card above</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.02]">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Surface
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Iterations
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Best Score
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Started
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Duration
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {runs.map((run) => {
            const StatusIcon = STATUS_ICONS[run.status];
            const statusStyle = STATUS_STYLES[run.status];
            return (
              <tr key={run.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 text-white font-medium">
                  {formatSurface(run.space.surface)}
                  {run.space.name && (
                    <span className="block text-xs text-gray-500 font-normal">{run.space.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle}`}
                  >
                    <StatusIcon
                      className={`h-3 w-3 ${run.status === 'running' ? 'animate-pulse' : ''}`}
                    />
                    {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                  {run.currentIteration}/{run.nIterations}
                </td>
                <td className="px-4 py-3 text-white font-medium">
                  {run.bestTarget !== null ? run.bestTarget.toFixed(3) : '—'}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {formatDate(run.startedAt)}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                  {formatDuration(run.startedAt, run.completedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default RunHistoryTable;
