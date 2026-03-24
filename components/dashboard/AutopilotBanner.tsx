'use client';

/**
 * AutopilotBanner
 * First-run onboarding banner shown when a user has not yet activated
 * the Autopilot Engine or connected a social platform.
 * Design system: charcoal bg, amber accent only — Scientific Luxury aesthetic.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, X, Zap, ChevronRight } from '@/components/icons';
import { cn } from '@/lib/utils';

const DISMISSED_KEY = 'synthex-autopilot-banner-dismissed';

interface AutopilotBannerProps {
  /** Pass true when user has 0 connected platforms */
  hasNoPlatforms?: boolean;
  /** Pass true when user has never activated Autopilot */
  autopilotInactive?: boolean;
  className?: string;
}

export function AutopilotBanner({
  hasNoPlatforms = false,
  autopilotInactive = true,
  className,
}: AutopilotBannerProps) {
  const [dismissed, setDismissed] = useState(true); // start hidden, hydrate below
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(DISMISSED_KEY);
    setDismissed(stored === 'true');
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  // Only show when relevant and not yet dismissed
  if (!mounted || dismissed) return null;
  if (!hasNoPlatforms && !autopilotInactive) return null;

  const isPlatformStep = hasNoPlatforms;

  return (
    <div
      role="banner"
      aria-label="Autopilot onboarding"
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
          {isPlatformStep ? (
            <Zap className="h-4 w-4 text-amber-500" />
          ) : (
            <Sparkles className="h-4 w-4 text-amber-500" />
          )}
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white/90 mb-0.5">
            {isPlatformStep
              ? 'Connect your first platform to get started'
              : 'Activate Autopilot Engine — post while you sleep'}
          </p>
          <p className="text-xs text-white/45 leading-relaxed">
            {isPlatformStep
              ? 'Connect Twitter, LinkedIn, Instagram or any other platform so Synthex can begin publishing and tracking your content automatically.'
              : 'Autopilot uses AI to research trending topics, generate posts, and schedule them for peak engagement — hands-free.'}
          </p>

          {/* Steps indicator */}
          <div className="flex items-center gap-3 mt-3">
            <span
              className={cn(
                'flex items-center gap-1.5 text-[10px] tracking-wide uppercase',
                isPlatformStep ? 'text-amber-500' : 'text-white/50'
              )}
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold border',
                  isPlatformStep
                    ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                    : 'border-white/10 text-white/60'
                )}
              >
                1
              </span>
              Connect platform
            </span>
            <ChevronRight className="h-3 w-3 text-white/40" />
            <span
              className={cn(
                'flex items-center gap-1.5 text-[10px] tracking-wide uppercase',
                !isPlatformStep ? 'text-amber-500' : 'text-white/50'
              )}
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold border',
                  !isPlatformStep
                    ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                    : 'border-white/10 text-white/60'
                )}
              >
                2
              </span>
              Activate Autopilot
            </span>
          </div>
        </div>

        {/* CTA + dismiss */}
        <div className="shrink-0 flex items-center gap-2 mt-0.5">
          <Link
            href={
              isPlatformStep ? '/dashboard/platforms' : '/dashboard/autonomous'
            }
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-sm transition-colors',
              'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 hover:text-amber-300',
              'border-[0.5px] border-amber-500/25 hover:border-amber-500/40'
            )}
          >
            {isPlatformStep ? 'Connect now' : 'Activate Autopilot'}
            <ChevronRight className="h-3 w-3" />
          </Link>
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
