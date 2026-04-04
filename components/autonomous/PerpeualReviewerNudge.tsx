'use client';

/**
 * PerpeualReviewerNudge — SYN-552
 *
 * Banner shown at shadow-post counts of 30, 45, and 60 when the client
 * has not yet activated any live mode tier. Encourages trial activation.
 *
 * Dismissal records a timestamp in nudge_dismissed_at (via POST /api/calendar/nudge-dismiss).
 * Re-shows after 7 days if dismissed. Disappears permanently after all 3 dismissed
 * (org tagged perpetual_reviewer: true).
 *
 * Suppressed automatically when liveModeT >= 1.
 */

import { useState, useCallback } from 'react';
import { X, Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PerpeualReviewerNudgeProps {
  /** Number of shadow posts reviewed — determines which threshold triggered */
  shadowPostsReviewed: number;
  approvalRate: number;
  nudgeDismissedAt: Record<string, string> | null;
  liveModeT: number;
  onDismissed: () => void;
  onActivate: () => void;
  className?: string;
}

const THRESHOLDS = [30, 45, 60] as const;
const SUPPRESS_DAYS = 7;

function shouldShowNudge(
  reviewed: number,
  nudgeDismissedAt: Record<string, string> | null,
  liveModeT: number
): (typeof THRESHOLDS)[number] | null {
  if (liveModeT >= 1) return null;

  for (const threshold of THRESHOLDS) {
    if (reviewed < threshold) continue;

    const dismissedAt = nudgeDismissedAt?.[String(threshold)];
    if (!dismissedAt) return threshold;

    // Re-show after 7 days
    const daysSince =
      (Date.now() - new Date(dismissedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince >= SUPPRESS_DAYS) return threshold;
  }

  return null;
}

export function PerpeualReviewerNudge({
  shadowPostsReviewed,
  approvalRate,
  nudgeDismissedAt,
  liveModeT,
  onDismissed,
  onActivate,
  className,
}: PerpeualReviewerNudgeProps) {
  const [dismissing, setDismissing] = useState(false);

  const threshold = shouldShowNudge(
    shadowPostsReviewed,
    nudgeDismissedAt,
    liveModeT
  );

  const handleDismiss = useCallback(async () => {
    if (!threshold) return;
    setDismissing(true);
    try {
      await fetch('/api/calendar/nudge-dismiss', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold }),
      });
      onDismissed();
    } catch {
      toast.error('Could not dismiss — please try again.');
    } finally {
      setDismissing(false);
    }
  }, [threshold, onDismissed]);

  if (!threshold) return null;

  const approvedCount = Math.round((approvalRate / 100) * shadowPostsReviewed);

  return (
    <div
      className={cn(
        'relative border border-orange-500/20 bg-orange-500/[0.04] rounded-sm p-4',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        disabled={dismissing}
        className="absolute top-3 right-3 text-white/30 hover:text-white/60 transition-colors"
        aria-label="Dismiss this suggestion"
      >
        {dismissing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <X className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Content */}
      <div className="pr-6 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-white">
            You&apos;ve approved{' '}
            <span className="text-orange-400">{approvedCount}</span> of{' '}
            {shadowPostsReviewed} posts.
          </p>
          <p className="text-xs text-white/40 leading-relaxed">
            Those {approvedCount} posts would have gone out automatically in
            live mode — while you slept.
          </p>
        </div>

        <Button
          onClick={onActivate}
          size="sm"
          className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Zap className="h-3.5 w-3.5" />
          Try Live Mode for 7 Days
        </Button>
      </div>
    </div>
  );
}
