'use client';

import type { CommandCentreStats as StatsType } from './types';

interface Props {
  stats: StatsType | null;
}

const STAT_ITEMS: Array<{
  key: keyof StatsType;
  label: string;
  format?: (v: number) => string;
}> = [
  { key: 'totalPostsGenerated', label: 'Posts Created' },
  { key: 'postsScheduled', label: 'Scheduled' },
  { key: 'postsPendingReview', label: 'Pending Review' },
  { key: 'postsPublished30d', label: 'Published (30d)' },
  { key: 'avgQualityScore', label: 'Avg Score', format: v => `${v}/100` },
  { key: 'connectedPlatforms', label: 'Platforms' },
];

export function CommandCentreStats({ stats }: Props) {
  return (
    <div className="border-[0.5px] border-white/[0.06] rounded-sm grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-white/[0.06]">
      {STAT_ITEMS.map(item => {
        const value = stats?.[item.key] ?? 0;
        return (
          <div key={item.key} className="px-5 py-4">
            <div className="text-xl font-light text-white tabular-nums">
              {item.format ? item.format(value) : value.toLocaleString()}
            </div>
            <div className="text-[10px] text-white/50 uppercase tracking-widest mt-1">
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
