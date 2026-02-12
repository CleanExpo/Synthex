'use client';

/**
 * Stat Card Component
 * Individual statistic display card
 */

import { cn } from '@/lib/utils';
import type { StatCardProps } from './types';

export function StatCard({ icon, label, value, trend, trendUp }: StatCardProps) {
  return (
    <div className="p-2 sm:p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors touch-manipulation">
      <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground mb-1 sm:mb-2">
        {icon}
        <span className="text-[10px] sm:text-xs truncate">{label}</span>
      </div>
      <div className="text-lg sm:text-2xl font-bold">{value}</div>
      <div className={cn(
        "text-[10px] sm:text-xs mt-0.5 sm:mt-1",
        trendUp ? "text-emerald-500" : "text-rose-500"
      )}>
        {trendUp ? "↑" : "↓"} {trend}
      </div>
    </div>
  );
}
