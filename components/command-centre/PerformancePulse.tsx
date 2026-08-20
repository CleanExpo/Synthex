'use client';

import { cn } from '@/lib/utils';
import type { PerformanceData } from './types';

interface Props {
  data: PerformanceData | null;
  variant?: 'default' | 'compact';
}

export function PerformancePulse({ data, variant = 'default' }: Props) {
  if (!data) return null;

  const { sevenDay, dailyBreakdown } = data;
  const compact = variant === 'compact';

  const maxEngagement = Math.max(
    ...dailyBreakdown.map(d => d.avgEngagement),
    0.01
  );

  return (
    <div
      className={cn(
        'rounded-sm border-[0.5px] border-white/6',
        compact ? 'p-4' : 'p-5'
      )}
    >
      <h3
        className={cn(
          'font-medium uppercase tracking-widest text-white/60',
          compact ? 'mb-3 text-[10px]' : 'mb-4 text-sm'
        )}
      >
        Performance Pulse
      </h3>

      <div
        className={cn(
          'flex items-end gap-1',
          compact ? 'mb-3 h-12' : 'mb-4 h-16'
        )}
      >
        {dailyBreakdown.map(day => {
          const heightPct =
            maxEngagement > 0 ? (day.avgEngagement / maxEngagement) * 100 : 0;
          return (
            <div
              key={day.date}
              className="flex flex-1 flex-col items-center gap-1"
            >
              <div
                className="min-h-[2px] w-full rounded-sm bg-brand-amber/35 transition-all"
                style={{ height: `${Math.max(heightPct, 3)}%` }}
              />
              <span className="text-[8px] text-white/50">
                {new Date(day.date).toLocaleDateString('en-AU', {
                  weekday: 'narrow',
                })}
              </span>
            </div>
          );
        })}
      </div>

      <div className={cn('grid grid-cols-3 gap-3', compact && 'gap-2')}>
        <MetricCard
          compact={compact}
          label="Avg Engagement"
          value={`${sevenDay.avgEngagement.toFixed(1)}%`}
        />
        <MetricCard
          compact={compact}
          label="Likes (7d)"
          value={sevenDay.totalLikes.toLocaleString()}
        />
        <MetricCard
          compact={compact}
          label="Comments (7d)"
          value={sevenDay.totalComments.toLocaleString()}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-sm border-[0.5px] border-white/6 bg-white/2 text-center',
        compact ? 'p-2.5' : 'p-3'
      )}
    >
      <div
        className={cn(
          'font-light tabular-nums text-white',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/50">
        {label}
      </div>
    </div>
  );
}
