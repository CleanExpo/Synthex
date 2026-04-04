'use client';

/**
 * Onboarding — Season Brief (SYN-548)
 *
 * "Your Market Outlook" screen — inserted between Brand Mirror and Connect Accounts.
 * Shows the next 4 highest-confidence seasonal opportunity windows for the client's
 * detected industry and AU location.
 *
 * Feature flag: NEXT_PUBLIC_SEASONAL_BRIEF_ONBOARDING (default: true)
 * — When false, onboarding/page.tsx routes directly to /onboarding/connect.
 *
 * A/B event: `onboarding_season_brief_shown` fires on mount with signal_count.
 * Companion events tracked downstream: onboarding_completed, social_account_connected.
 *
 * Flow position:
 *   Brand Mirror → [Season Brief] → Connect Accounts
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  TrendingUp,
  Star,
  Loader2,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StepProgressV2 } from '@/components/onboarding';
import { fireEvent } from '@/lib/analytics/onboarding-events';
import { ONBOARDING_INDUSTRY_TO_SLUG } from '@/lib/constants/onboarding';
import type { PipelineResult } from '@/lib/ai/onboarding-pipeline';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SeasonalSignal {
  id: string;
  opportunityLabel: string;
  windowStart: string;
  windowEnd: string;
  confidenceScore: number;
  signalType: string;
  source: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()} – ${e.getDate()} ${months[e.getMonth()]}`;
  }
  return `${s.getDate()} ${months[s.getMonth()]} – ${e.getDate()} ${months[e.getMonth()]}`;
}

function confidenceLabel(score: number): { label: string; colour: string } {
  if (score >= 80) return { label: 'High confidence', colour: 'bg-green-500' };
  return { label: 'Moderate confidence', colour: 'bg-amber-400' };
}

function signalTypeIcon(signalType: string) {
  switch (signalType) {
    case 'seasonal_peak':
    case 'trend_spike':
      return <TrendingUp className="h-4 w-4 text-orange-400 shrink-0" />;
    case 'school_term':
      return <Star className="h-4 w-4 text-blue-400 shrink-0" />;
    default:
      return <CalendarDays className="h-4 w-4 text-white/50 shrink-0" />;
  }
}

function whyThisMatters(signal: SeasonalSignal, industrySlug: string): string {
  const base = signal.opportunityLabel;
  if (signal.signalType === 'holiday')
    return `${base} — a key consumer spending window across Australia.`;
  if (signal.signalType === 'school_term')
    return `${base} drives purchase intent in your market.`;
  if (industrySlug === 'plumbing-hvac')
    return `${base} — service enquiries spike sharply in this window.`;
  if (industrySlug === 'cafe-coffee')
    return `${base} — foot traffic and beverage demand peak now.`;
  if (industrySlug === 'retail-general')
    return `${base} — your highest-revenue window of the season.`;
  if (industrySlug === 'allied-health')
    return `${base} — appointment demand and referrals peak.`;
  if (industrySlug === 'personal-fitness')
    return `${base} — membership enquiries and class bookings surge.`;
  return `${base} — a prime opportunity to engage your audience.`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SeasonBriefPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<SeasonalSignal[]>([]);
  const [industrySlug, setIndustrySlug] = useState('general');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read industry from previous pipeline result (stored in onboarding/page.tsx)
    let slug = 'general';
    try {
      const raw = sessionStorage.getItem('synthex_pipeline_result');
      if (raw) {
        const result = JSON.parse(raw) as PipelineResult;
        slug =
          ONBOARDING_INDUSTRY_TO_SLUG[result.industry?.toLowerCase() ?? ''] ??
          'general';
      }
    } catch {
      // sessionStorage unavailable or JSON parse error — use 'general' fallback
    }
    setIndustrySlug(slug);

    // Fetch signals — resolves from pre-computed cache, should be < 1s
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    fetch(
      `/api/seasonal-signals?industrySlug=${encodeURIComponent(slug)}&locationState=AU&limit=4`,
      {
        credentials: 'include',
        signal: controller.signal,
      }
    )
      .then(r => (r.ok ? r.json() : { signals: [] }))
      .then(data => {
        const fetched: SeasonalSignal[] = data.signals ?? [];
        setSignals(fetched);
        // A/B analytics — fires once on mount
        fireEvent('onboarding_season_brief_shown', {
          industry_slug: slug,
          signal_count: fetched.length,
        });
      })
      .catch(() => {
        setSignals([]);
        fireEvent('onboarding_season_brief_shown', {
          industry_slug: slug,
          signal_count: 0,
        });
      })
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  const handleContinue = () => {
    router.push('/onboarding/connect');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <StepProgressV2 currentStep={2} />

      {/* Header */}
      <div className="text-center space-y-3">
        <span className="text-[10px] uppercase tracking-[0.3em] text-orange-400/70">
          Your Market Outlook
        </span>
        <h1 className="text-3xl font-light tracking-tight text-white">
          Synthex already knows{' '}
          <span className="text-orange-400">what&apos;s coming.</span>
        </h1>
        <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
          Based on your industry, here are the next market opportunity windows
          Synthex will help you capitalise on.
        </p>
      </div>

      {/* Signal cards */}
      <div
        className={cn(
          'grid gap-3',
          signals.length > 0 ? 'sm:grid-cols-2' : 'grid-cols-1'
        )}
        aria-live="polite"
        aria-label="Seasonal market signals"
      >
        {loading ? (
          <div className="col-span-2 flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
          </div>
        ) : signals.length > 0 ? (
          signals.map(signal => {
            const { label, colour } = confidenceLabel(signal.confidenceScore);
            return (
              <div
                key={signal.id}
                className="border border-white/[0.06] bg-white/[0.02] rounded-sm p-5 space-y-3 hover:border-orange-500/20 transition-colors"
              >
                {/* Label + icon */}
                <div className="flex items-start gap-2">
                  {signalTypeIcon(signal.signalType)}
                  <h3 className="text-sm font-medium text-white leading-snug">
                    {signal.opportunityLabel}
                  </h3>
                </div>

                {/* Date range */}
                <p className="text-xs text-orange-300/80 font-mono">
                  {formatDateRange(signal.windowStart, signal.windowEnd)}
                </p>

                {/* Why this matters */}
                <p className="text-xs text-white/40 leading-relaxed">
                  {whyThisMatters(signal, industrySlug)}
                </p>

                {/* Confidence indicator */}
                <div className="flex items-center gap-2">
                  <span
                    className={cn('inline-block w-2 h-2 rounded-full', colour)}
                    aria-hidden="true"
                  />
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">
                    {label}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          /* Fallback — no signals for this industry/state */
          <div className="border border-white/[0.06] bg-white/[0.02] rounded-sm p-6 text-center space-y-3">
            <CalendarDays className="h-8 w-8 text-white/20 mx-auto" />
            <p className="text-sm text-white/50 leading-relaxed">
              Your industry-specific market signals are loading — check back in
              24 hours for personalised opportunities.
            </p>
            <p className="text-xs text-white/30">
              In the meantime, Synthex will start with AU national public
              holidays and peak consumer periods.
            </p>
          </div>
        )}
      </div>

      {/* Content recommendation note */}
      {signals.length > 0 && (
        <p className="text-center text-xs text-white/25">
          Synthex will pre-load content for each window — 2–3 posts starting 2
          weeks before each peak.
        </p>
      )}

      {/* CTA — cannot be blocked, always available */}
      <div className="flex justify-center pt-2">
        <Button
          onClick={handleContinue}
          className="gap-2 bg-orange-500 hover:bg-orange-600 text-white px-8"
          size="lg"
        >
          Continue to connect accounts
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
