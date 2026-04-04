'use client';

/**
 * WhyThisPostPanel — SYN-551 Trust Architecture Layer
 *
 * Hover/tap panel shown on auto-scheduled post cards explaining why Synthex
 * chose this post. Displays performance signals, Seasonal Engine data,
 * Brand IQ voice match score, and Review Intelligence context.
 *
 * Rendered < 200ms — reads from cached post metadata passed as props,
 * no live API calls on hover.
 */

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { HelpCircle, TrendingUp, Leaf, Mic2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PostSignals {
  /** e.g. "Your Wednesday posts average 2.1× Tuesday engagement" */
  performanceSignal?: string;
  /** e.g. "+34% search volume for 'emergency plumber' this week in QLD" */
  seasonalSignal?: string;
  /** 0–100 — how well this caption matches the org's Brand IQ voice profile */
  voiceMatchScore?: number;
  /** e.g. "Recent GBP reviews mention prompt response times" */
  reviewContext?: string;
  /** true when post was manually scheduled (hides performance history) */
  isManual?: boolean;
}

interface WhyThisPostPanelProps {
  signals: PostSignals;
  className?: string;
}

export function WhyThisPostPanel({
  signals,
  className,
}: WhyThisPostPanelProps) {
  const {
    performanceSignal,
    seasonalSignal,
    voiceMatchScore,
    reviewContext,
    isManual = false,
  } = signals;

  const hasContent =
    (!isManual && performanceSignal) ||
    seasonalSignal ||
    voiceMatchScore !== undefined ||
    reviewContext;

  if (!hasContent) return null;

  return (
    <Popover>
      <PopoverTrigger asChild aria-label="Why was this post chosen?">
        <button
          className={cn(
            'inline-flex items-center justify-center rounded-full p-1',
            'text-muted-foreground hover:text-foreground transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className
          )}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-72 p-3 space-y-2.5 text-sm"
        aria-label="Post selection reasons"
      >
        <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
          Why This Post?
        </p>

        {!isManual && performanceSignal && (
          <SignalRow
            icon={<TrendingUp className="h-3.5 w-3.5 text-cyan-400" />}
            label={performanceSignal}
          />
        )}

        {seasonalSignal && (
          <SignalRow
            icon={<Leaf className="h-3.5 w-3.5 text-green-400" />}
            label={seasonalSignal}
          />
        )}

        {voiceMatchScore !== undefined && (
          <SignalRow
            icon={<Mic2 className="h-3.5 w-3.5 text-violet-400" />}
            label={`Voice match: ${voiceMatchScore}%`}
            badge={
              voiceMatchScore >= 90
                ? 'Strong'
                : voiceMatchScore >= 70
                  ? 'Good'
                  : 'Moderate'
            }
            badgeVariant={
              voiceMatchScore >= 90
                ? 'default'
                : voiceMatchScore >= 70
                  ? 'secondary'
                  : 'outline'
            }
          />
        )}

        {reviewContext && (
          <SignalRow
            icon={<Star className="h-3.5 w-3.5 text-amber-400" />}
            label={reviewContext}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function SignalRow({
  icon,
  label,
  badge,
  badgeVariant = 'secondary',
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="text-foreground/80 leading-snug">{label}</span>
      {badge && (
        <Badge variant={badgeVariant} className="ml-auto shrink-0 text-[10px]">
          {badge}
        </Badge>
      )}
    </div>
  );
}
