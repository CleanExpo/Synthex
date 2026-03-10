'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSocialConnections } from '@/hooks/use-social-connections';
import { X, Zap } from '@/components/icons';

const DISMISS_KEY = 'socialBannerDismissed';

export function SocialConnectBanner() {
  const { summary, isLoading } = useSocialConnections();
  // Start dismissed=true to avoid hydration flash, then read localStorage on mount
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Check localStorage only after mount to avoid SSR mismatch
    const wasDismissed = localStorage.getItem(DISMISS_KEY) === 'true';
    setDismissed(wasDismissed);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  // Show only when: loaded, not dismissed, zero connections
  if (isLoading || dismissed || (summary && summary.connected > 0)) {
    return null;
  }

  return (
    <div className="mx-4 mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 p-2 rounded-lg bg-cyan-500/20">
          <Zap className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Connect your first social account</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Link a platform to start publishing, scheduling, and tracking performance.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href="/dashboard/platforms"
          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold transition-colors"
        >
          Connect a platform
        </Link>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss banner"
          className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
