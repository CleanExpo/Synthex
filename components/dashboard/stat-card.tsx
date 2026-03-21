'use client';

import { cn } from '@/lib/utils';
import type { StatCardProps } from './types';

export function StatCard({
  icon,
  label,
  value,
  trend,
  trendUp,
}: StatCardProps) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm hover:bg-white/[0.03] transition-colors">
      <div className="flex items-center gap-1.5 text-white/50">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.2em]">{label}</span>
      </div>
      <span className="font-mono text-xl font-medium tabular-nums leading-none text-white">
        {value}
      </span>
      <span
        className={cn(
          'text-[10px] font-mono tabular-nums',
          trendUp ? 'text-emerald-400' : 'text-red-400'
        )}
      >
        {trendUp ? '↑' : '↓'} {trend}
      </span>
    </div>
  );
}
