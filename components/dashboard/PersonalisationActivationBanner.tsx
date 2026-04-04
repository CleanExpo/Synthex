'use client';

/**
 * PersonalisationActivationBanner — SYN-637
 *
 * One-time, dismissable in-app notification that fires when a client's
 * personalisation threshold is crossed (>= 50 analysed posts). Shows
 * what changed and why it matters.
 *
 * Follows the same dismissal pattern as AutopilotBanner:
 *   - Start hidden (dismissed = true) to avoid hydration flash
 *   - Read localStorage on mount
 *   - Persist dismissal per orgId
 *
 * Colour: amber/yellow tones (distinct from GA4ConnectBanner cyan).
 */

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Sparkles, X } from '@/components/icons';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/fetcher';

interface PersonalisationData {
  postCount: number;
  isPersonalised: boolean;
}

interface PersonalisationResponse {
  success: boolean;
  data: PersonalisationData;
}

function dismissedKey(orgId: string): string {
  return `personalisationBannerDismissed_${orgId}`;
}

interface PersonalisationActivationBannerProps {
  /** Active organisation ID — null when not loaded or all-businesses mode */
  orgId: string | null;
  className?: string;
}

export function PersonalisationActivationBanner({
  orgId,
  className,
}: PersonalisationActivationBannerProps) {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const [mounted, setMounted] = useState(false);

  // Only fetch when we have an orgId
  const { data } = useSWR<PersonalisationResponse>(
    orgId ? '/api/dashboard/personalisation-status' : null,
    fetchJson,
    { revalidateOnFocus: false }
  );

  const isPersonalised = data?.data?.isPersonalised ?? false;
  const postCount = data?.data?.postCount ?? 0;

  useEffect(() => {
    setMounted(true);
    if (orgId) {
      const stored = localStorage.getItem(dismissedKey(orgId));
      setDismissed(stored === 'true');
    }
  }, [orgId]);

  const handleDismiss = () => {
    if (orgId) {
      localStorage.setItem(dismissedKey(orgId), 'true');
    }
    setDismissed(true);
  };

  // Only render when: mounted, org loaded, personalisation active, not dismissed
  if (!mounted || !orgId || !isPersonalised || dismissed) return null;

  return (
    <div
      role="banner"
      aria-label="Personalisation activation"
      className={cn(
        'relative overflow-hidden rounded-sm border-[0.5px]',
        'border-amber-500/20 bg-amber-500/[0.04]',
        'px-5 py-4',
        className
      )}
    >
      {/* Subtle amber glow strip at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-sm bg-amber-500/10 border-[0.5px] border-amber-500/20 mt-0.5">
          <Sparkles className="h-4 w-4 text-amber-500" />
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white/90 mb-0.5">
            Your content is now personalised
          </p>
          <p className="text-xs text-white/45 leading-relaxed">
            Synthex has learned from{' '}
            <span className="text-amber-400 font-medium">{postCount}</span> of
            your past posts and is generating content based on what actually
            works for you.
          </p>

          {/* Learn more link (placeholder) */}
          <a
            href="#"
            className="inline-block mt-2 text-xs text-amber-500/70 hover:text-amber-500/90 transition-colors"
          >
            Learn more
          </a>
        </div>

        {/* Dismiss button */}
        <div className="shrink-0 mt-0.5">
          <button
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="p-1.5 rounded-sm text-white/60 hover:text-white/50 hover:bg-white/[0.04] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
