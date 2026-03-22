'use client';

import { cn } from '@/lib/utils';
import { useAutopilotToggle } from '@/hooks/useAutopilotToggle';
import type { AutopilotStatus } from './types';

interface Props {
  status: AutopilotStatus | null;
  onToggled?: () => void;
}

const STATUS_COLOURS: Record<string, string> = {
  green: 'bg-emerald-400',
  yellow: 'bg-orange-400',
  red: 'bg-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  generating: 'Generating…',
  scheduling: 'Scheduling…',
  paused: 'Paused',
  error: 'Error',
};

export function AutopilotStatusBar({ status, onToggled }: Props) {
  const { toggle, isToggling } = useAutopilotToggle();
  const autopilot = status?.autopilot;
  const enabled = autopilot?.enabled ?? false;
  const pipelineHealth = status?.pipelineHealth ?? 'yellow';

  const handleToggle = async () => {
    const result = await toggle(!enabled);
    if (result) onToggled?.();
  };

  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-[0.5px] border-white/[0.06] bg-white/[0.02] rounded-sm">
      <div className="flex items-center gap-4">
        {/* Pipeline health indicator */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              STATUS_COLOURS[pipelineHealth]
            )}
          />
          <span className="text-xs text-white/50 uppercase tracking-widest">
            Autopilot
          </span>
        </div>

        {/* Status label */}
        <span className="text-sm text-white/70">
          {STATUS_LABELS[autopilot?.status ?? 'idle'] ?? 'Unknown'}
        </span>

        {/* Next run */}
        {autopilot?.nextRunAt && (
          <span className="text-xs text-white/50">
            Next run:{' '}
            {new Date(autopilot.nextRunAt).toLocaleString('en-AU', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}

        {/* Error message */}
        {autopilot?.lastErrorMessage && (
          <span className="text-xs text-red-400/70 truncate max-w-[200px]">
            {autopilot.lastErrorMessage}
          </span>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={handleToggle}
        disabled={isToggling}
        className={cn(
          'px-4 py-1.5 text-xs font-medium tracking-wide rounded-sm transition-all',
          enabled
            ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-[0.5px] border-emerald-500/20'
            : 'bg-white/[0.04] hover:bg-white/[0.08] text-white/50 border-[0.5px] border-white/[0.08]',
          isToggling && 'opacity-60 cursor-not-allowed'
        )}
      >
        {isToggling ? 'Updating…' : enabled ? 'Running' : 'Start Autopilot'}
      </button>
    </div>
  );
}
