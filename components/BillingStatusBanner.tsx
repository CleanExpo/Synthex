'use client';

/**
 * BillingStatusBanner — Phase 3 PR 3
 *
 * Global banner injected into the dashboard layout. Renders ONLY when the
 * user's billing is in a non-current state. Five states:
 *
 *  - `current`                  — render nothing (the happy path; the
 *                                  default when no DunningState row exists)
 *  - `past_due`                 — payment failed, retries scheduled
 *  - `unpaid`                   — all retries exhausted, subscription
 *                                  about to cancel
 *  - `paused`                   — subscription paused at user request
 *  - `cancelled_grace_period`   — cancelled, access until period end
 *
 * Renders gracefully when the DunningState row is absent — the API
 * resolves to `{ state: 'current' }` and this component returns null.
 *
 * @phase Synthex Phase 3 — Customer Self-Service
 * @mandate 493b042a-521c-44af-9cb2-43505593b65c
 */

import Link from 'next/link';
import useSWR from 'swr';
import { fetchJson } from '@/lib/fetcher';
import { AlertTriangle, CreditCard, Pause, Calendar } from '@/components/icons';
import { cn } from '@/lib/utils';

type BillingState =
  | 'current'
  | 'past_due'
  | 'unpaid'
  | 'paused'
  | 'cancelled_grace_period';

interface DunningStateResponse {
  state: BillingState;
  failedAttempts?: number;
  nextRetryAt?: string | null;
  lastFailureAt?: string | null;
  recoveredAt?: string | null;
}

const STATE_CONFIG: Record<
  Exclude<BillingState, 'current'>,
  {
    title: string;
    body: string;
    cta: string;
    Icon: React.ComponentType<{ className?: string }>;
    accent: string;
    border: string;
  }
> = {
  past_due: {
    title: 'Your latest payment failed',
    body: 'We will automatically retry over the next 14 days. To avoid losing access, update your payment method now.',
    cta: 'Update payment method',
    Icon: AlertTriangle,
    accent: 'text-amber-300',
    border: 'border-amber-500/30 bg-amber-500/[0.04]',
  },
  unpaid: {
    title: 'Your subscription is unpaid',
    body: 'All retry attempts have failed. Your subscription will be cancelled shortly unless you update your payment method.',
    cta: 'Resolve now',
    Icon: CreditCard,
    accent: 'text-red-300',
    border: 'border-red-500/40 bg-red-500/[0.05]',
  },
  paused: {
    title: 'Your subscription is paused',
    body: 'Resume your subscription to continue using premium features.',
    cta: 'Resume subscription',
    Icon: Pause,
    accent: 'text-blue-300',
    border: 'border-blue-500/30 bg-blue-500/[0.04]',
  },
  cancelled_grace_period: {
    title: 'Your subscription will end soon',
    body: 'You have cancelled. Access continues until the end of your current billing period.',
    cta: 'Reactivate',
    Icon: Calendar,
    accent: 'text-orange-300',
    border: 'border-orange-500/30 bg-orange-500/[0.04]',
  },
};

export function BillingStatusBanner({ className }: { className?: string }) {
  const { data } = useSWR<DunningStateResponse>(
    '/api/billing/dunning-state',
    fetchJson,
    {
      revalidateOnFocus: false,
      refreshInterval: 5 * 60 * 1000, // 5 min — billing state changes are rare
      shouldRetryOnError: false,
    }
  );

  // Default to `current` when the row is absent — the brief mandates graceful
  // rendering. `current` and `recovered` both suppress the banner.
  const state: BillingState = data?.state ?? 'current';
  if (state === 'current') return null;
  // `recovered` is a transient state — webhook flipped from past_due to
  // recovered; treat as current for banner suppression.
  // (Type system prevents `recovered` from reaching here.)

  const config = STATE_CONFIG[state];
  if (!config) return null;

  const { title, body, cta, Icon, accent, border } = config;

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="billing-status-banner"
      data-state={state}
      className={cn(
        'mb-5 flex items-start gap-3 rounded-sm border-[0.5px] px-4 py-3',
        border,
        className
      )}
    >
      <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', accent)} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', accent)}>{title}</p>
        <p className="text-xs text-white/60 mt-0.5">{body}</p>
      </div>
      <Link
        href="/dashboard/settings/billing"
        className={cn(
          'flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-sm border-[0.5px] transition-colors',
          'border-white/[0.1] hover:bg-white/[0.04]',
          accent
        )}
      >
        {cta}
      </Link>
    </div>
  );
}

export default BillingStatusBanner;
