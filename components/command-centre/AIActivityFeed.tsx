'use client';

import type { AIActivityItem } from './types';
import { ActivityFeedItem } from './ActivityFeedItem';

interface Props {
  items: AIActivityItem[];
}

export function AIActivityFeed({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="border-[0.5px] border-white/[0.06] rounded-sm p-6">
        <h3 className="text-sm font-medium text-white/60 uppercase tracking-widest mb-4">
          AI Activity
        </h3>
        <div className="text-center py-8">
          <p className="text-sm text-white/50">No AI activity yet</p>
          <p className="text-xs text-white/50 mt-1">
            Activity will appear here once autopilot generates content
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-[0.5px] border-white/[0.06] rounded-sm p-5">
      <h3 className="text-sm font-medium text-white/60 uppercase tracking-widest mb-4">
        AI Activity
      </h3>
      <div className="max-h-[400px] overflow-y-auto">
        {items.map(item => (
          <ActivityFeedItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
