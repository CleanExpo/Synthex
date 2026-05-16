'use client';

/**
 * Billing Settings Page — Phase 3 PR 1
 *
 * Standalone /dashboard/settings/billing route that wraps the existing
 * Stripe billing-portal API. Renders the current plan + entry points to:
 *
 *   - Open the Stripe-hosted billing portal (manage payment, view invoices)
 *   - Upgrade / downgrade via POST /api/stripe/change-plan
 *   - Cancel (defers to Stripe portal cancel flow — no inline confirm here)
 *
 * Visual pattern: Tailwind + Radix UI (existing Synthex design system).
 * NOT the Unite-Group SpotlightCard/PortfolioTile wrappers (out of scope).
 *
 * @phase Synthex Phase 3 — Customer Self-Service
 * @mandate 493b042a-521c-44af-9cb2-43505593b65c
 */

import { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, ChevronRight, Zap } from '@/components/icons';
import { useSubscription } from '@/hooks/useSubscription';
import { fetchWithCSRF } from '@/lib/csrf';
import { cn } from '@/lib/utils';


type PlanSlug =
  | 'free'
  | 'starter'
  | 'pro'
  | 'growth'
  | 'scale'
  | 'professional'
  | 'business'
  | 'custom';

interface PlanRow {
  slug: PlanSlug;
  label: string;
  price: string;
  blurb: string;
}

const PLAN_CATALOG: PlanRow[] = [
  {
    slug: 'pro',
    label: 'Pro',
    price: '$249 AUD/mo',
    blurb: '5 social accounts, 100 AI posts/month, 3 personas',
  },
  {
    slug: 'growth',
    label: 'Growth',
    price: '$449 AUD/mo',
    blurb: 'Higher limits + advanced analytics',
  },
  {
    slug: 'scale',
    label: 'Scale',
    price: '$799 AUD/mo',
    blurb: 'Unlimited posts + priority support',
  },
];

export default function BillingSettingsPage() {
  const { subscription, isLoading, refetch } = useSubscription();
  const [actionState, setActionState] = useState<
    | { kind: 'idle' }
    | { kind: 'opening_portal' }
    | { kind: 'changing_plan'; target: PlanSlug }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const openPortal = useCallback(async () => {
    setActionState({ kind: 'opening_portal' });
    try {
      const res = await fetchWithCSRF('/api/stripe/billing-portal', {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to open billing portal');
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch (err) {
      setActionState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, []);

  const changePlan = useCallback(
    async (target: PlanSlug) => {
      setActionState({ kind: 'changing_plan', target });
      try {
        const res = await fetchWithCSRF('/api/stripe/change-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPlan: target }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? 'Failed to change plan');
        }
        await refetch();
        setActionState({ kind: 'idle' });
      } catch (err) {
        setActionState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [refetch]
  );

  if (isLoading) {
    return (
      <div className="p-8">
        <div
          data-testid="billing-loading"
          className="h-32 rounded-sm border-[0.5px] border-white/[0.06] animate-pulse bg-white/[0.02]"
        />
      </div>
    );
  }

  const currentPlan = subscription?.plan ?? 'free';
  const isFree = currentPlan === 'free';

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Billing</h1>
        <p className="text-sm text-white/60 mt-1">
          Manage your subscription, payment method, and invoices.
        </p>
      </header>

      {actionState.kind === 'error' && (
        <div
          role="alert"
          data-testid="billing-error"
          className="rounded-sm border-[0.5px] border-red-500/30 bg-red-500/[0.04] px-4 py-3 text-sm text-red-300"
        >
          {actionState.message}
        </div>
      )}

      {/* Current Plan */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            {isFree ? 'You are on the free tier' : 'Active subscription'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            data-testid="current-plan"
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="capitalize">
                {currentPlan}
              </Badge>
              {subscription?.cancelAtPeriodEnd && (
                <span className="text-xs text-orange-300">
                  Cancels at period end
                </span>
              )}
            </div>
            {!isFree && (
              <Button
                onClick={openPortal}
                disabled={actionState.kind === 'opening_portal'}
                variant="outline"
                size="sm"
                data-testid="manage-payment-btn"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {actionState.kind === 'opening_portal'
                  ? 'Opening...'
                  : 'Manage payment'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan picker */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>{isFree ? 'Upgrade your plan' : 'Change plan'}</CardTitle>
          <CardDescription>
            {isFree
              ? 'Unlock premium features'
              : 'Up- or downgrade — proration is applied automatically.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {PLAN_CATALOG.map(plan => {
            const isCurrent = plan.slug === currentPlan;
            const isPending =
              actionState.kind === 'changing_plan' &&
              actionState.target === plan.slug;
            return (
              <button
                key={plan.slug}
                type="button"
                disabled={isCurrent || isPending}
                onClick={() => changePlan(plan.slug)}
                data-testid={`plan-row-${plan.slug}`}
                data-current={isCurrent ? 'true' : 'false'}
                className={cn(
                  'w-full text-left flex items-center justify-between gap-4',
                  'rounded-sm border-[0.5px] border-white/[0.06] bg-white/[0.02]',
                  'px-4 py-3 transition-colors',
                  !isCurrent && 'hover:bg-white/[0.04] cursor-pointer',
                  isCurrent && 'opacity-60 cursor-default'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-white/40" />
                    <span className="font-medium text-white">{plan.label}</span>
                    {isCurrent && (
                      <Badge variant="outline" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-white/50 mt-0.5">{plan.blurb}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  <span className="text-sm text-white/70">{plan.price}</span>
                  {!isCurrent && (
                    <ChevronRight className="h-4 w-4 text-white/40" />
                  )}
                </div>
                {isPending && (
                  <span
                    className="text-xs text-blue-300"
                    data-testid={`plan-pending-${plan.slug}`}
                  >
                    Updating...
                  </span>
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Cancel (defers to Stripe portal) */}
      {!isFree && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Cancel subscription</CardTitle>
            <CardDescription>
              You will retain access until the end of the current billing
              period.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={openPortal}
              variant="ghost"
              size="sm"
              data-testid="cancel-btn"
              className="text-red-300 hover:text-red-200"
            >
              Cancel via billing portal
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
