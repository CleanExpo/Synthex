'use client';

/**
 * FirstWinBanner
 *
 * Displays a prominent, dismissible full-width banner when the user has an
 * unread 'first_win' notification. This is the Days 7-21 retention anchor —
 * the specific moment a client's post outperforms their baseline by ≥ 30%.
 *
 * The banner auto-dismisses (marks notification read) when the ✕ is clicked.
 * It does not re-appear once dismissed.
 *
 * Data source: /api/notifications (same endpoint as NotificationBell)
 * — SWR deduplication means zero extra network requests when both components
 *   are mounted simultaneously.
 *
 * @task SYN-525
 */

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { fetchJson } from '@/lib/fetcher';
import { fetchWithCSRF } from '@/lib/csrf';
import { cn } from '@/lib/utils';

interface WinData {
  postId?: string;
  metric?: string;
  actualValue?: number;
  baselineValue?: number;
  improvementPct?: number;
  detectedAt?: string;
}

interface RawNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data?: WinData;
}

export function FirstWinBanner({ className }: { className?: string }) {
  const { data, mutate } = useSWR('/api/notifications', fetchJson, {
    // Share the cache with NotificationBell — 0 extra requests
    dedupingInterval: 60_000,
    refreshInterval: 30_000,
  });

  const [isDismissing, setIsDismissing] = useState(false);

  // Find the first unread first_win notification
  const notifications: RawNotification[] = data?.notifications ?? [];
  const firstWinNotif = notifications.find(
    n => n.type === 'first_win' && !n.read
  );

  const dismiss = useCallback(async () => {
    if (!firstWinNotif || isDismissing) return;

    setIsDismissing(true);
    try {
      await fetchWithCSRF(`/api/notifications/${firstWinNotif.id}/read`, {
        method: 'PATCH',
      });
      // Optimistically update — removes banner immediately
      await mutate();
    } finally {
      setIsDismissing(false);
    }
  }, [firstWinNotif, isDismissing, mutate]);

  if (!firstWinNotif) return null;

  const winData = firstWinNotif.data;
  const improvementPct = winData?.improvementPct;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'relative flex items-start gap-4 rounded-sm border border-amber-500/30',
        'bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent',
        'px-5 py-4 animate-in slide-in-from-top-2 duration-500',
        className
      )}
    >
      {/* Celebration icon */}
      <span className="text-2xl flex-shrink-0 mt-0.5" aria-hidden="true">
        🎉
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-400">
          {firstWinNotif.title}
        </p>
        <p className="text-sm text-white/80 mt-0.5 leading-relaxed">
          {firstWinNotif.message}
        </p>

        {/* Improvement pill */}
        {improvementPct != null && (
          <span className="inline-flex items-center mt-2 px-2.5 py-1 rounded-sm text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            +{improvementPct}% above your average
          </span>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={dismiss}
        disabled={isDismissing}
        aria-label="Dismiss first win notification"
        className="flex-shrink-0 text-white/30 hover:text-white/70 transition-colors mt-0.5 p-1 rounded-sm hover:bg-white/[0.04] disabled:opacity-40"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
