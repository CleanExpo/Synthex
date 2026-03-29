'use client';

/**
 * WinAnchoredConversionCard
 *
 * Replaces the generic "upgrade to unlock features" prompt with copy anchored
 * to the client's actual results — or platform-level social proof when no win
 * is yet detected.
 *
 * A/B test:
 *   - variant 'win'     — leads with the client's specific first win metric
 *   - variant 'control' — existing generic upgrade messaging
 *
 * Variant assignment is random 50/50, stored in localStorage for consistency.
 * Vercel Analytics fires `trial_conversion_cta_click` with variant + has_win_data
 * properties on every CTA click.
 *
 * ⚠️ COPY REVIEW REQUIRED — Phill sign-off needed before this ships (SYN-526).
 *
 * @task SYN-526
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { track } from '@vercel/analytics';
import { Zap, ArrowUpRight, TrendingUp } from '@/components/icons';
import { fetchJson } from '@/lib/fetcher';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Variant = 'win' | 'control';

interface WinData {
  metric?: string;
  actualValue?: number;
  baselineValue?: number;
  improvementPct?: number;
}

interface RawNotification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  data?: WinData;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VARIANT_KEY = 'synthex_conv_variant';

/** Assign a 50/50 variant, persisted in localStorage for consistency */
function getOrAssignVariant(): Variant {
  if (typeof window === 'undefined') return 'control';
  const stored = localStorage.getItem(VARIANT_KEY) as Variant | null;
  if (stored === 'win' || stored === 'control') return stored;
  const assigned: Variant = Math.random() < 0.5 ? 'win' : 'control';
  localStorage.setItem(VARIANT_KEY, assigned);
  return assigned;
}

// ─── Copy variants ────────────────────────────────────────────────────────────
// ⚠️ Phill review checkpoint — confirm copy before enabling in production

interface CopySet {
  headline: string;
  subtext: string;
  cta: string;
  subCta: string;
}

function buildWinCopy(win: WinData | undefined): CopySet {
  if (win?.improvementPct != null && win.improvementPct > 0) {
    // Specific win known — anchor to the result
    const metricLabel =
      win.metric === 'engagementRate'
        ? 'engagement'
        : (win.metric ?? 'performance');
    return {
      headline: `Your content is working — keep the momentum going.`,
      subtext: `Your best post delivered ${win.improvementPct}% more ${metricLabel} than your average. Clients who keep going from here see compounding results in weeks 4–8.`,
      cta: 'Keep my momentum',
      subCta: "See what's included \u2192",
    };
  }

  // No specific win data yet — platform-level social proof fallback
  return {
    headline: `Your audience is warming up.`,
    subtext: `Synthex clients who reach week 4 typically see 40\u201360% more reach than in week 1. The compounding starts now \u2014 keep going.`,
    cta: 'Keep my momentum',
    subCta: "See what's included \u2192",
  };
}

function buildControlCopy(): CopySet {
  return {
    headline: `Unlock the full platform.`,
    subtext: `Upgrade to access more social accounts, unlimited AI posts, and advanced analytics.`,
    cta: 'View Plans & Pricing',
    subCta: "Explore what's included \u2192",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface WinAnchoredConversionCardProps {
  className?: string;
}

export function WinAnchoredConversionCard({
  className,
}: WinAnchoredConversionCardProps) {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>('control');

  // Assign variant once on mount
  useEffect(() => {
    setVariant(getOrAssignVariant());
  }, []);

  // Re-use the notifications cache — no extra network request
  const { data } = useSWR('/api/notifications', fetchJson, {
    dedupingInterval: 60_000,
    refreshInterval: 30_000,
  });

  const notifications: RawNotification[] = data?.notifications ?? [];
  const firstWinNotif = notifications.find(n => n.type === 'first_win');
  const winData = firstWinNotif?.data;
  const hasWinData = winData?.improvementPct != null;

  const copy = variant === 'win' ? buildWinCopy(winData) : buildControlCopy();

  const handleCtaClick = useCallback(() => {
    track('trial_conversion_cta_click', {
      variant,
      has_win_data: hasWinData,
    });
    router.push('/pricing');
  }, [variant, hasWinData, router]);

  const isWinVariant = variant === 'win';

  return (
    <div
      className={cn(
        'p-4 rounded-sm border-[0.5px] transition-colors',
        isWinVariant
          ? 'bg-gradient-to-br from-amber-500/[0.07] to-transparent border-amber-500/25'
          : 'bg-orange-500/[0.05] border-orange-500/20',
        className
      )}
    >
      {/* Icon + headline */}
      <div className="flex items-start gap-3 mb-3">
        {isWinVariant ? (
          <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        ) : (
          <Zap className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
        )}
        <p
          className={cn(
            'text-xs font-medium leading-relaxed',
            isWinVariant ? 'text-amber-300' : 'text-orange-200/80'
          )}
        >
          {copy.headline}
        </p>
      </div>

      {/* Body copy */}
      <p className="text-xs text-white/50 leading-relaxed mb-4 pl-[22px]">
        {copy.subtext}
      </p>

      {/* Primary CTA */}
      <button
        onClick={handleCtaClick}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-sm transition-colors',
          isWinVariant
            ? 'bg-amber-500 hover:bg-amber-400 text-[#050505]'
            : 'bg-orange-500 hover:bg-orange-400 text-[#050505]'
        )}
      >
        {copy.cta}
        <ArrowUpRight className="w-3.5 h-3.5" />
      </button>

      {/* Sub-CTA link */}
      <div className="mt-2 text-center">
        <button
          onClick={handleCtaClick}
          className={cn(
            'text-[10px] underline-offset-2 hover:underline transition-colors',
            isWinVariant
              ? 'text-amber-400/60 hover:text-amber-300'
              : 'text-orange-400/60 hover:text-orange-300'
          )}
        >
          {copy.subCta}
        </button>
      </div>
    </div>
  );
}
