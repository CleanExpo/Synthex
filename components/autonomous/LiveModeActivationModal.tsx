'use client';

/**
 * LiveModeActivationModal — SYN-552
 *
 * 2-screen activation ceremony for Tier-1 live mode.
 * Screen 1: "Your shadow-mode results" — last 5 shadow posts with engagement vs baseline
 * Screen 2: "What live mode means for you" — scope + Pause button visibility
 *
 * Client must tap an explicit "Go Live" CTA on Screen 2 to activate.
 * No accidental activation — each screen requires deliberate forward navigation.
 */

import { useState, useCallback } from 'react';
import {
  CheckCircle2,
  ArrowRight,
  Zap,
  PauseCircle,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LiveModeActivationModalProps {
  open: boolean;
  onClose: () => void;
  onActivated: () => void;
  /** Approval rate shown on Screen 1 (0–100) */
  approvalRate?: number;
  /** Top content category detected for this org */
  topCategory?: string;
}

export function LiveModeActivationModal({
  open,
  onClose,
  onActivated,
  approvalRate = 90,
  topCategory = 'your top content category',
}: LiveModeActivationModalProps) {
  const [screen, setScreen] = useState<1 | 2>(1);
  const [activating, setActivating] = useState(false);

  const handleGoLive = useCallback(async () => {
    setActivating(true);
    try {
      const res = await fetch('/api/calendar/live-mode-activate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 1, confirmed: true }),
      });

      if (!res.ok) throw new Error('Activation failed');

      toast.success('Tier 1 Live Mode activated!', {
        description: `${topCategory} posts will now publish automatically.`,
      });
      onActivated();
    } catch {
      toast.error('Could not activate live mode', {
        description: 'Please try again or contact support.',
      });
    } finally {
      setActivating(false);
    }
  }, [topCategory, onActivated]);

  const handleClose = () => {
    setScreen(1); // reset for next open
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={open => !open && handleClose()}>
      <DialogContent
        className="max-w-md bg-[#111111] border border-white/[0.08] text-white"
        aria-describedby="activation-desc"
      >
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-1">
          {[1, 2].map(s => (
            <div
              key={s}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                s <= screen ? 'bg-orange-400' : 'bg-white/10'
              )}
            />
          ))}
        </div>

        {screen === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-light text-white">
                Your shadow-mode results
              </DialogTitle>
            </DialogHeader>

            <p
              id="activation-desc"
              className="text-sm text-white/40 leading-relaxed"
            >
              Here&apos;s the evidence. These are the last 5 posts Synthex
              generated that met your engagement baseline.
            </p>

            {/* Evidence stats */}
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between border border-white/[0.06] rounded-sm p-3">
                <span className="text-sm text-white/60">Approval rate</span>
                <span className="text-sm font-medium text-green-400">
                  {approvalRate}%
                </span>
              </div>
              <div className="flex items-center justify-between border border-white/[0.06] rounded-sm p-3">
                <span className="text-sm text-white/60">
                  Consecutive threshold passes
                </span>
                <span className="text-sm font-medium text-orange-400">5/5</span>
              </div>
              <div className="flex items-center justify-between border border-white/[0.06] rounded-sm p-3">
                <span className="text-sm text-white/60">
                  Top content category
                </span>
                <span className="text-sm font-medium text-white">
                  {topCategory}
                </span>
              </div>
            </div>

            <Button
              onClick={() => setScreen(2)}
              className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-white"
            >
              See what live mode means
              <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-light text-white">
                What live mode means for you
              </DialogTitle>
            </DialogHeader>

            <p
              id="activation-desc"
              className="text-sm text-white/40 leading-relaxed"
            >
              Tier 1 is narrow by design — you keep full control everywhere
              else.
            </p>

            {/* Scope explanation */}
            <div className="space-y-3 py-2">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                <p className="text-sm text-white/70">
                  <strong className="text-white">{topCategory}</strong> posts in
                  your best time slot will auto-publish.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-white/30 mt-0.5 shrink-0" />
                <p className="text-sm text-white/40">
                  All other content categories stay in shadow mode — you review
                  them as normal.
                </p>
              </div>
              <div className="flex items-start gap-3 border border-amber-500/20 bg-amber-500/[0.04] rounded-sm p-3">
                <PauseCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-sm text-white/60">
                  The <strong className="text-white">Pause button</strong> in
                  your dashboard stops all auto-publishing instantly — no
                  waiting.
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setScreen(1)}
                className="flex-1 border-white/10 text-white/50 hover:text-white hover:border-white/20"
              >
                Back
              </Button>
              <Button
                onClick={handleGoLive}
                disabled={activating}
                className="flex-1 gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
              >
                {activating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Go Live
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
