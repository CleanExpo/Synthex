'use client';

import type { PendingContent } from './types';
import { PendingContentCard } from './PendingContentCard';

interface Props {
  items: PendingContent[];
  onAction?: () => void;
}

export function PendingApprovalQueue({ items, onAction }: Props) {
  if (items.length === 0) {
    return (
      <div className="border-[0.5px] border-white/[0.06] rounded-sm p-6">
        <h3 className="text-sm font-medium text-white/60 uppercase tracking-widest mb-4">
          Pending Review
        </h3>
        <div className="text-center py-8">
          <p className="text-sm text-white/50">All caught up</p>
          <p className="text-xs text-white/50 mt-1">
            No posts waiting for your approval
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-[0.5px] border-white/[0.06] rounded-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white/60 uppercase tracking-widest">
          Pending Review
        </h3>
        <span className="text-xs text-white/50">{items.length} awaiting</span>
      </div>
      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {items.map(item => (
          <PendingContentCard key={item.id} item={item} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}
