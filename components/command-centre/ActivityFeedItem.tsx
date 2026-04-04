'use client';

import { cn } from '@/lib/utils';
import { openAIPMWithContext } from '@/components/ai-pm/AIPMFloatingButton';
import type { AIActivityItem } from './types';

interface Props {
  item: AIActivityItem;
}

const RUN_TYPE_ICONS: Record<string, string> = {
  kickstart: '🚀',
  daily: '📅',
  trend_react: '📈',
  repurpose: '♻️',
  ab_test: '🧪',
};

const STATUS_COLOURS: Record<string, string> = {
  running: 'text-cyan-400',
  completed: 'text-emerald-400',
  partial: 'text-orange-400',
  failed: 'text-red-400',
};

export function ActivityFeedItem({ item }: Props) {
  const icon = RUN_TYPE_ICONS[item.metadata.runType] ?? '⚡';
  const timeAgo = getTimeAgo(item.timestamp);

  return (
    <div className="flex gap-3 py-3 border-b border-white/[0.04] last:border-0">
      {/* Icon */}
      <div className="w-8 h-8 flex items-center justify-center bg-white/[0.04] border-[0.5px] border-white/[0.06] rounded-sm text-sm shrink-0">
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/80">{item.action}</span>
          <span
            className={cn(
              'text-[10px] uppercase tracking-wider',
              STATUS_COLOURS[item.status]
            )}
          >
            {item.status}
          </span>
        </div>
        <p className="text-xs text-white/40 mt-0.5 truncate">
          {item.description}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] text-white/50">{timeAgo}</span>
          {item.durationMs && (
            <span className="text-[10px] text-white/50">
              {(item.durationMs / 1000).toFixed(1)}s
            </span>
          )}
          <button
            onClick={() =>
              openAIPMWithContext(
                `Explain this AI action: ${item.action}. ${item.description}`
              )
            }
            className="text-[10px] text-white/50 hover:text-cyan-400 transition-colors"
            title="Ask AI PM about this action"
          >
            ?
          </button>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
