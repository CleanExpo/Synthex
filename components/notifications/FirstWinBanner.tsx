'use client';

import { useState } from 'react';

interface FirstWinBannerProps {
  notificationId: string;
  title: string;
  body: string;
  improvementPct: number;
}

export default function FirstWinBanner({
  notificationId,
  title,
  body,
  improvementPct,
}: FirstWinBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = async () => {
    setDismissed(true);
    try {
      await fetch(`/api/notifications/${notificationId}/read`, { method: 'PATCH' });
    } catch {
      // Optimistic — dismiss locally even if API fails
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="relative flex items-start gap-4 rounded-xl border border-orange-400/30 bg-gradient-to-r from-orange-950/60 to-amber-950/40 px-5 py-4 shadow-lg"
    >
      {/* Win accent bar */}
      <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-orange-400" aria-hidden="true" />

      {/* Icon */}
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-400/20 text-xl">
        🎉
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-orange-300">{title}</p>
        <p className="mt-1 text-sm text-slate-300 leading-relaxed">{body}</p>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-orange-400/15 px-2.5 py-0.5">
          <span className="text-xs font-mono font-bold text-orange-400">+{improvementPct}%</span>
          <span className="text-xs text-slate-400">above your average</span>
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
