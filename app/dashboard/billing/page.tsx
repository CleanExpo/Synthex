'use client';

/**
 * Billing Page
 *
 * Displays subscription status, billing management, and usage limits.
 *
 * @task UNI-633 - Show "Free Plan" with appropriate messaging for free-tier users
 * @task UNI-634 - Fix unlimited plan progress bars rendering at 0% width
 */

import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Package,
  Calendar,
  ArrowUpRight,
  Download,
  AlertCircle,
  RefreshCw,
  Zap,
} from '@/components/icons';
import { WinAnchoredConversionCard } from '@/components/billing/WinAnchoredConversionCard';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Subscription {
  plan: string;
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: string;
}

interface UsageData {
  usage: {
    aiPosts: number;
    socialAccounts: number;
    personas: number;
  };
  limits: {
    aiPosts: number;
    socialAccounts: number;
    personas: number;
  };
  percentages: {
    aiPosts: number;
    socialAccounts: number;
    personas: number;
  };
}

type UsageResource = 'aiPosts' | 'socialAccounts' | 'personas';

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const router = useRouter();

  const fetchSubscription = useCallback(async () => {
    setError(null);
    try {
      const token =
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('auth_token') ||
        localStorage.getItem('token');

      const [subResponse, usageResponse] = await Promise.all([
        fetch('/api/user/subscription', {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
        fetch('/api/user/usage', {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
      ]);

      if (subResponse.ok) {
        const data = await subResponse.json();
        setSubscription(data);
      } else if (subResponse.status === 404) {
        setSubscription({ plan: 'free', status: 'inactive' });
      } else {
        setError('Failed to load subscription details');
      }

      if (usageResponse.ok) {
        const usage = await usageResponse.json();
        setUsageData(usage);
      }
    } catch (fetchError) {
      console.error('Error fetching subscription:', fetchError);
      setError('Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const openBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const token =
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('auth_token') ||
        localStorage.getItem('token');
      const response = await fetch('/api/stripe/billing-portal', {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.bypass) {
          toast.error(data.message || 'Billing portal not available');
          return;
        }
        throw new Error('Failed to open billing portal');
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Billing portal error:', error);
      toast.error('Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  const getStatusColour = (status: string) => {
    switch (status) {
      case 'active':
      case 'trialing':
        return '#00FF88';
      case 'past_due':
        return '#FFB800';
      case 'canceled':
      case 'unpaid':
        return '#FF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: string | undefined) => {
    if (!status || status === 'inactive') return 'Free Plan';
    switch (status) {
      case 'active':
        return 'Active';
      case 'trialing':
        return 'Trial';
      case 'past_due':
        return 'Past Due';
      case 'canceled':
        return 'Canceled';
      case 'unpaid':
        return 'Unpaid';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isFreePlan = !subscription || subscription.plan === 'free';

  const isUnlimited = (resource: UsageResource): boolean => {
    return usageData?.limits[resource] === -1;
  };

  const renderUsageRow = (
    label: string,
    resource: UsageResource,
    fallbackLimit: number
  ) => {
    const currentUsage = usageData?.usage[resource] ?? 0;
    const limit = usageData?.limits[resource] ?? fallbackLimit;
    const unlimited = !limit || limit <= 0;
    const percentage = unlimited
      ? 100
      : Math.min(usageData?.percentages[resource] ?? 0, 100);

    return (
      <div key={resource}>
        <div className="flex justify-between mb-2">
          <span className="text-xs text-white/40">{label}</span>
          <span className="font-mono text-xs text-white/60 tabular-nums">
            {unlimited ? (
              <>
                {currentUsage} /{' '}
                <span className="text-orange-400">Unlimited</span>
              </>
            ) : (
              <>
                {currentUsage} / {limit}
              </>
            )}
          </span>
        </div>
        {unlimited ? (
          <span className="text-[10px] text-orange-400 uppercase tracking-[0.15em]">
            Unlimited
          </span>
        ) : (
          <div className="h-px bg-white/[0.06] overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
      </div>
    );
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-9 w-48 bg-white/[0.04] rounded-sm" />
        <div className="space-y-4">
          <div className="h-36 bg-white/[0.03] border-[0.5px] border-white/[0.04] rounded-sm" />
          <div className="h-36 bg-white/[0.03] border-[0.5px] border-white/[0.04] rounded-sm" />
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="border-[0.5px] border-red-500/20 bg-red-500/[0.03] rounded-sm p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 border-[0.5px] border-red-500/20 bg-red-500/[0.08] rounded-sm flex items-center justify-center mb-5">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <h3 className="text-base font-light text-white mb-2">
              Billing Error
            </h3>
            <p className="text-sm text-white/40 mb-6 max-w-md">{error}</p>
            <button
              onClick={fetchSubscription}
              className="flex items-center gap-2 px-4 py-2.5 border-[0.5px] border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] rounded-sm text-xs text-white/50 hover:text-white/70 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page title */}
      <div className="mb-6">
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-2 block">
          Account
        </span>
        <h1 className="text-3xl font-extralight tracking-tight text-white">
          Billing &amp; Subscription
        </h1>
        <div className="mt-5 h-px bg-white/[0.06]" />
      </div>

      {/* Current Plan */}
      <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b-[0.5px] border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-white/50" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
              Current Plan
            </span>
          </div>
          {isFreePlan ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[9px] uppercase tracking-[0.15em] bg-orange-500/[0.08] text-orange-400 border-[0.5px] border-orange-500/20">
              Free Plan
            </span>
          ) : (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-sm text-[9px] uppercase tracking-[0.15em] border-[0.5px]"
              style={{
                color: getStatusColour(subscription?.status || 'inactive'),
                borderColor: `${getStatusColour(subscription?.status || 'inactive')}40`,
                backgroundColor: `${getStatusColour(subscription?.status || 'inactive')}08`,
              }}
            >
              {getStatusLabel(subscription?.status)}
            </span>
          )}
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 mb-1">
              Plan Type
            </p>
            <p className="font-mono text-2xl font-medium text-orange-400 tabular-nums capitalize">
              {subscription?.plan || 'Free'}
            </p>
          </div>

          {isFreePlan ? (
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 mb-1">
                Status
              </p>
              <p className="text-sm text-white/60">
                Active — no billing required
              </p>
            </div>
          ) : subscription?.currentPeriodEnd ? (
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 mb-1">
                {subscription.cancelAtPeriodEnd
                  ? 'Expires On'
                  : 'Next Billing Date'}
              </p>
              <p className="text-sm text-white/60">
                {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
          ) : null}
        </div>

        {/* Free plan upgrade prompt — win-anchored variant (SYN-526) */}
        {isFreePlan && (
          <div className="mx-6 mb-6">
            <WinAnchoredConversionCard />
          </div>
        )}

        {/* Cancellation warning */}
        {subscription?.cancelAtPeriodEnd && (
          <div className="mx-6 mb-6 flex items-center gap-2 p-3 bg-orange-500/[0.05] border-[0.5px] border-orange-500/20 rounded-sm">
            <AlertCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <p className="text-xs text-orange-200/70">
              Your subscription will end on{' '}
              {formatDate(subscription.currentPeriodEnd!)}
            </p>
          </div>
        )}
      </div>

      {/* Billing Management */}
      <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b-[0.5px] border-white/[0.06] flex items-center gap-2">
          <CreditCard className="w-3.5 h-3.5 text-white/50" />
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
            Billing Management
          </span>
        </div>

        <div className="p-6">
          {isFreePlan ? (
            <div>
              <WinAnchoredConversionCard className="mb-0" />
            </div>
          ) : (
            <div>
              <p className="text-sm text-white/40 mb-6 leading-relaxed">
                Manage your subscription, payment methods, and download invoices
                through the Stripe billing portal.
              </p>
              <div className="space-y-3">
                <button
                  onClick={openBillingPortal}
                  disabled={portalLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-400 text-[#050505] text-xs font-semibold tracking-wide rounded-sm transition-colors disabled:opacity-60"
                >
                  {portalLoading ? (
                    'Opening Portal…'
                  ) : (
                    <>
                      <span>Open Billing Portal</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => router.push('/pricing')}
                    className="flex items-center justify-center gap-2 py-2.5 border-[0.5px] border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] rounded-sm text-xs text-white/50 hover:text-white/70 transition-colors"
                  >
                    View Plans
                  </button>
                  <button
                    onClick={openBillingPortal}
                    disabled={portalLoading}
                    className="flex items-center justify-center gap-2 py-2.5 border-[0.5px] border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] rounded-sm text-xs text-white/50 hover:text-white/70 transition-colors disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    View Invoices
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Usage & Limits */}
      <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b-[0.5px] border-white/[0.06] flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-white/50" />
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
            Usage &amp; Limits
          </span>
        </div>

        <div className="p-6 space-y-5">
          {renderUsageRow('AI Posts Generated', 'aiPosts', 10)}
          {renderUsageRow('Social Accounts', 'socialAccounts', 2)}
          {renderUsageRow('AI Personas', 'personas', 1)}

          <div className="pt-2 px-4 py-3 bg-orange-500/[0.05] border-[0.5px] border-orange-500/20 rounded-sm">
            <p className="text-xs text-orange-200/70">
              {isFreePlan ? (
                <>
                  Want more?{' '}
                  <a
                    href="/pricing"
                    className="underline hover:text-orange-100"
                  >
                    Upgrade your plan
                  </a>{' '}
                  to unlock higher limits and advanced features.
                </>
              ) : isUnlimited('aiPosts') ? (
                <>
                  You have unlimited access on your current plan. Enjoy creating
                  without limits!
                </>
              ) : (
                <>
                  Need more?{' '}
                  <a
                    href="/pricing"
                    className="underline hover:text-orange-100"
                  >
                    Upgrade your plan
                  </a>{' '}
                  to unlock higher limits and advanced features.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
