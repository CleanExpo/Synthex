'use client';

/**
 * Lane (swim-lane) for the Quick Access Storyboard.
 *
 * Each lane represents one status. Cards inside flow horizontally on wide
 * screens, stack vertically on narrow ones.
 */

import type { ItemStatus, QuickAccessItem } from '@/lib/quick-access/items';
import { StoryboardCard } from './StoryboardCard';

interface StoryboardLaneProps {
  status: ItemStatus;
  label: string;
  description: string;
  emoji: string;
  items: QuickAccessItem[];
}

export function StoryboardLane({
  label,
  description,
  emoji,
  items,
}: StoryboardLaneProps) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xl" aria-hidden="true">
            {emoji}
          </span>
          <h2 className="text-lg font-semibold">{label}</h2>
          <span className="font-mono text-xs text-muted-foreground">
            ({items.length})
          </span>
        </div>
        <p className="hidden text-xs text-muted-foreground md:block">{description}</p>
      </header>
      <p className="text-xs text-muted-foreground md:hidden">{description}</p>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          Empty — nothing in this lane right now.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map(item => (
            <StoryboardCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
