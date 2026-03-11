'use client';

/**
 * AgentActivityFeed — Phase 99
 *
 * Displays recent actions from all v5.0 AI agents in a unified feed.
 * Colour-coded by agent type with relative timestamps.
 */

import Link from 'next/link';
import {
  Shield,
  Sparkles,
  Beaker,
  Link2,
  Brain,
} from '@/components/icons';
import type { AgentActivity, AgentType } from '@/lib/citation/aggregator';

interface AgentActivityFeedProps {
  activities: AgentActivity[];
  loading?: boolean;
}

interface AgentMeta {
  Icon: React.ComponentType<{ className?: string }>;
  colour: string;
  label: string;
}

const AGENT_META: Record<AgentType, AgentMeta> = {
  sentinel: { Icon: Shield, colour: 'text-cyan-400 bg-cyan-500/10', label: 'Sentinel' },
  healing: { Icon: Sparkles, colour: 'text-emerald-400 bg-emerald-500/10', label: 'Self-Healing' },
  quality: { Icon: Sparkles, colour: 'text-amber-400 bg-amber-500/10', label: 'Quality Gate' },
  prompt: { Icon: Brain, colour: 'text-purple-400 bg-purple-500/10', label: 'Prompt Intel' },
  backlink: { Icon: Link2, colour: 'text-blue-400 bg-blue-500/10', label: 'Backlink' },
  experiment: { Icon: Beaker, colour: 'text-pink-400 bg-pink-500/10', label: 'Experiment' },
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AgentActivityFeed({
  activities,
  loading = false,
}: AgentActivityFeedProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-white/5 animate-pulse rounded w-3/4" />
              <div className="h-2.5 bg-white/5 animate-pulse rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Brain className="w-8 h-8 text-gray-600 mb-2" />
        <p className="text-sm text-gray-500">No recent agent activity</p>
        <p className="text-xs text-gray-600 mt-1">
          Agents will appear here once they run
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((activity) => {
        const meta = AGENT_META[activity.agent] ?? AGENT_META.sentinel;
        const { Icon, colour, label } = meta;
        const [iconColour, iconBg] = colour.split(' ');

        return (
          <Link
            key={activity.id}
            href={activity.href}
            className="flex items-start gap-3 rounded-lg p-2 hover:bg-white/[0.03] transition-colors group"
          >
            {/* Agent icon */}
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}
            >
              <Icon className={`w-4 h-4 ${iconColour}`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-semibold ${iconColour}`}>
                  {label}
                </span>
              </div>
              <p className="text-sm text-gray-300 truncate group-hover:text-white transition-colors">
                {activity.action}
              </p>
            </div>

            {/* Time */}
            <span className="text-xs text-gray-500 flex-shrink-0 mt-0.5">
              {timeAgo(activity.createdAt)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
