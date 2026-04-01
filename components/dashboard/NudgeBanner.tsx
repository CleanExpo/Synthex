'use client';

/**
 * NudgeBanner
 *
 * Displays active Tier 1 in-app intervention nudges for the current client.
 * Nudges are fetched from /api/client/nudges and rendered inline in the dashboard.
 * Individually dismissible via localStorage — re-appears after 7 days when
 * the intervention engine may re-fire.
 *
 * SYN-617
 */

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { X, TrendingDown, Star, MessageSquare, BarChart2, Users, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/fetcher';

interface Nudge {
  id: string;
  dimension: string;
  tier: number;
  text: string;
  createdAt: string;
}

const DIMENSION_ICON: Record<string, React.ElementType> = {
  content_consistency: Zap,
  engagement_trajectory: TrendingDown,
  review_responsiveness: MessageSquare,
  authority_momentum: Star,
  advisor_engagement: Users,
  platform_usage: BarChart2,
};

const DIMENSION_COLOUR: Record<string, string> = {
  content_consistency: 'border-violet-500/40 bg-violet-950/30',
  engagement_trajectory: 'border-amber-500/40 bg-amber-950/30',
  review_responsiveness: 'border-sky-500/40 bg-sky-950/30',
  authority_momentum: 'border-emerald-500/40 bg-emerald-950/30',
  advisor_engagement: 'border-rose-500/40 bg-rose-950/30',
  platform_usage: 'border-orange-500/40 bg-orange-950/30',
};

const ICON_COLOUR: Record<string, string> = {
  content_consistency: 'text-violet-400',
  engagement_trajectory: 'text-amber-400',
  review_responsiveness: 'text-sky-400',
  authority_momentum: 'text-emerald-400',
  advisor_engagement: 'text-rose-400',
  platform_usage: 'text-orange-400',
};

function dismissedKey(id: string): string {
  return `synthex-nudge-dismissed-${id}`;
}

interface NudgeCardProps {
  nudge: Nudge;
}

function NudgeCard({ nudge }: NudgeCardProps) {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(dismissedKey(nudge.id));
    setDismissed(stored === 'true');
  }, [nudge.id]);

  const handleDismiss = () => {
    localStorage.setItem(dismissedKey(nudge.id), 'true');
    setDismissed(true);
  };

  if (!mounted || dismissed) return null;

  const Icon = DIMENSION_ICON[nudge.dimension] ?? TrendingDown;
  const colourClass = DIMENSION_COLOUR[nudge.dimension] ?? 'border-zinc-500/40 bg-zinc-900/30';
  const iconColour = ICON_COLOUR[nudge.dimension] ?? 'text-zinc-400';

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3',
        colourClass
      )}
      role="alert"
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconColour)} />
      <p className="flex-1 text-sm text-zinc-200 leading-relaxed">{nudge.text}</p>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="ml-2 shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Renders active intervention nudges at the top of the dashboard.
 * Shows at most 2 nudges. Returns null if there are none.
 */
export function NudgeBanner({ className }: { className?: string }) {
  const { data } = useSWR<{ nudges: Nudge[] }>('/api/client/nudges', fetchJson, {
    refreshInterval: 300_000, // Re-check every 5 minutes
    revalidateOnFocus: false,
  });

  const nudges = data?.nudges ?? [];
  if (nudges.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {nudges.map(nudge => (
        <NudgeCard key={nudge.id} nudge={nudge} />
      ))}
    </div>
  );
}
