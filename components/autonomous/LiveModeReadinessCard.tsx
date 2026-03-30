'use client';

/**
 * LiveModeReadinessCard — SYN-552
 *
 * Shows shadow-mode progress toward Tier-1 live mode activation.
 * Visible only when calendarMode === 'shadow' and liveModeT === 0.
 * Hidden once any live mode tier is activated.
 *
 * Polls /api/calendar/live-mode-readiness every 60s via SWR.
 * Shows "Ready to go live" state when consecutivePasses >= 5.
 */

import useSWR from 'swr';
import { Zap, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

interface ReadinessData {
  liveModeT: number;
  calendarMode: string;
  shadowPostsReviewed: number;
  approvalRate: number;
  consecutivePasses: number;
  readyToActivate: boolean;
  perpetualReviewer: boolean;
}

interface LiveModeReadinessCardProps {
  onActivate: () => void;
  className?: string;
}

const THRESHOLD = 5;

export function LiveModeReadinessCard({
  onActivate,
  className,
}: LiveModeReadinessCardProps) {
  const { data } = useSWR<ReadinessData>(
    '/api/calendar/live-mode-readiness',
    fetchJson,
    { refreshInterval: 60_000 }
  );

  // Don't render until data loads or if already live
  if (!data || data.liveModeT >= 1 || data.calendarMode !== 'shadow') {
    return null;
  }

  const {
    shadowPostsReviewed,
    approvalRate,
    consecutivePasses,
    readyToActivate,
  } = data;

  const progressPct = Math.min((consecutivePasses / THRESHOLD) * 100, 100);

  return (
    <div
      className={cn(
        'border border-white/[0.06] bg-white/[0.02] rounded-sm p-5 space-y-4',
        readyToActivate && 'border-orange-500/30 bg-orange-500/[0.04]',
        className
      )}
      role="region"
      aria-label="Live mode readiness"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap
            className={cn(
              'h-4 w-4',
              readyToActivate ? 'text-orange-400' : 'text-white/30'
            )}
          />
          <span className="text-sm font-medium text-white">
            Live Mode Readiness
          </span>
        </div>
        {readyToActivate && (
          <span className="text-[10px] uppercase tracking-widest text-orange-400 font-medium">
            Ready
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="space-y-1">
          <p className="text-lg font-light text-white">{shadowPostsReviewed}</p>
          <p className="text-[10px] text-white/30 uppercase tracking-wider">
            Posts Reviewed
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-lg font-light text-white">{approvalRate}%</p>
          <p className="text-[10px] text-white/30 uppercase tracking-wider">
            Approval Rate
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-lg font-light text-white">
            {consecutivePasses}/{THRESHOLD}
          </p>
          <p className="text-[10px] text-white/30 uppercase tracking-wider">
            Consecutive
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div
          className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={consecutivePasses}
          aria-valuemin={0}
          aria-valuemax={THRESHOLD}
          aria-label={`${consecutivePasses} of ${THRESHOLD} consecutive posts at engagement baseline`}
        >
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              readyToActivate ? 'bg-orange-400' : 'bg-white/20'
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-[10px] text-white/25 text-center">
          {readyToActivate
            ? 'Synthex has earned your trust on your top content category.'
            : `${THRESHOLD} consecutive posts at or above your engagement baseline unlock Tier 1 Live Mode`}
        </p>
      </div>

      {/* CTA — only shown when ready */}
      {readyToActivate && (
        <Button
          onClick={onActivate}
          className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-white"
          size="sm"
        >
          <Zap className="h-3.5 w-3.5" />
          Go Live — Tier 1
        </Button>
      )}

      {!readyToActivate && (
        <div className="flex items-center gap-2 text-[10px] text-white/25">
          <Clock className="h-3 w-3 shrink-0" />
          <span>
            Keep reviewing posts — the streak resets on rejection or low
            engagement.
          </span>
        </div>
      )}
    </div>
  );
}
