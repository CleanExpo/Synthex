'use client';

// SYN-526: Win-anchored trial-end conversion
// Shows the client's best trial result front-and-centre.
// A/B: 'win' variant (this) vs 'control' (existing copy).

import { useState } from 'react';
import { track } from '@vercel/analytics';

export interface TrialWinData {
  metricLabel: string;  // e.g. "impressions"
  actualValue: number;  // e.g. 312
  improvementPct: number; // e.g. 47
  postDay: string;      // e.g. "Tuesday"
}

interface TrialEndModalProps {
  variant: 'win' | 'control';
  winData?: TrialWinData | null;
  daysRemaining: number;
  onSubscribe: () => void;
  onDismiss: () => void;
}

export default function TrialEndModal({
  variant,
  winData,
  daysRemaining,
  onSubscribe,
  onDismiss,
}: TrialEndModalProps) {
  const [loading, setLoading] = useState(false);
  const hasWinData = variant === 'win' && !!winData;

  const handleSubscribe = () => {
    setLoading(true);
    track('trial_conversion_cta_click', {
      variant,
      has_win_data: hasWinData,
    });
    onSubscribe();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-end-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onDismiss} aria-hidden="true" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900 p-8 shadow-2xl">
        {hasWinData && winData ? (
          // WIN VARIANT — anchor to demonstrated result
          <>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-400/20 text-2xl">
                🚀
              </div>
              <div>
                <p className="text-xs font-mono text-orange-400 tracking-widest uppercase">Your momentum is real</p>
                <h2 id="trial-end-title" className="text-xl font-bold text-white mt-0.5">Don't lose what you've built</h2>
              </div>
            </div>

            {/* Win highlight */}
            <div className="mb-6 rounded-xl border border-orange-400/20 bg-orange-950/30 p-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Your {winData.postDay} post got{' '}
                <span className="font-bold text-white">{winData.actualValue.toLocaleString()} {winData.metricLabel}</span>
                {' '}—{' '}
                <span className="font-bold text-orange-400">+{winData.improvementPct}%</span>{' '}
                above your average.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Week 4 clients average 2.4× the results of Week 1. Your audience is warming up.
              </p>
            </div>

            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full rounded-xl bg-orange-500 px-6 py-3.5 text-base font-semibold text-white transition-all hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 disabled:opacity-60"
            >
              {loading ? 'Processing...' : 'Keep your momentum →'}
            </button>
          </>
        ) : (
          // CONTROL VARIANT or no win data — opportunity framing (not fear)
          <>
            <div className="mb-6">
              <p className="text-xs font-mono text-slate-400 tracking-widest uppercase mb-2">Your trial ends in {daysRemaining} day{daysRemaining === 1 ? '' : 's'}</p>
              <h2 id="trial-end-title" className="text-2xl font-bold text-white">Your audience is warming up</h2>
              <p className="mt-3 text-slate-400 text-sm leading-relaxed">
                Synthex clients who reach Week 4 see an average{' '}
                <span className="text-white font-medium">2.4× improvement</span>{' '}
                in post performance. The compounding is just starting.
              </p>
            </div>

            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full rounded-xl bg-orange-500 px-6 py-3.5 text-base font-semibold text-white transition-all hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 disabled:opacity-60"
            >
              {loading ? 'Processing...' : 'Continue growing →'}
            </button>
          </>
        )}

        <button
          onClick={onDismiss}
          className="mt-4 w-full text-center text-xs text-slate-500 hover:text-slate-400 transition-colors"
        >
          Remind me later
        </button>
      </div>
    </div>
  );
}
