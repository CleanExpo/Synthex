'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  Package,
  Calendar,
  ArrowUpRight,
  Download,
  AlertCircle,
  RefreshCw
} from '@/components/icons';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface Subscription {
  plan: string;
  status: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
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
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || localStorage.getItem('token');

      const [subResponse, usageResponse] = await Promise.all([
        fetch('/api/user/subscription', {
          credentials: 'include',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        }),
        fetch('/api/user/usage', {
          credentials: 'include',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        }),
      ]);

      if (subResponse.ok) {
        const data = await subResponse.json();
        setSubscription(data);
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
  }, [router]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const openBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || localStorage.getItem('token');
      const response = await fetch('/api/stripe/billing-portal', {
        method: 'POST',
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if it's a bypass response (Stripe not configured)
        if (data.bypass) {
          toast.error(data.message || 'Billing portal not available');
          return;
        }
        throw new Error('Failed to open billing portal');
      }

      const { url } = data;
      window.location.href = url;
    } catch (error) {
      console.error('Billing portal error:', error);
      toast.error('Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'trialing':
        return 'bg-green-500';
      case 'past_due':
        return 'bg-yellow-500';
      case 'canceled':
      case 'unpaid':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-cyan-900 to-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-white/10 rounded w-1/4 mb-8"></div>
            <div className="space-y-4">
              <div className="h-32 bg-white/10 rounded"></div>
              <div className="h-32 bg-white/10 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-cyan-900 to-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <Card variant="glass" className="p-6 border-red-500/20">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-red-500/10 mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Billing Error</h3>
              <p className="text-gray-400 mb-6 max-w-md">{error}</p>
              <Button onClick={fetchSubscription} variant="outline" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-cyan-900 to-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Billing & Subscription</h1>

        {/* Current Plan */}
        <Card variant="glass" className="p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Package className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">Current Plan</h2>
            </div>
            <Badge className={`${getStatusColor(subscription?.status || 'inactive')} text-white`}>
              {subscription?.status || 'No Active Subscription'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-gray-400 mb-1">Plan Type</p>
              <p className="text-2xl font-bold gradient-text capitalize">
                {subscription?.plan || 'Free'}
              </p>
            </div>

            {subscription?.current_period_end && (
              <div>
                <p className="text-gray-400 mb-1">
                  {subscription.cancel_at_period_end ? 'Expires On' : 'Next Billing Date'}
                </p>
                <p className="text-xl text-white">
                  {formatDate(subscription.current_period_end)}
                </p>
              </div>
            )}
          </div>

          {subscription?.cancel_at_period_end && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                <p className="text-yellow-200">
                  Your subscription will end on {formatDate(subscription.current_period_end!)}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Billing Management */}
        <Card variant="glass" className="p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <CreditCard className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-semibold text-white">Billing Management</h2>
          </div>

          <p className="text-gray-400 mb-6">
            Manage your subscription, payment methods, and download invoices through the Stripe billing portal.
          </p>

          <div className="space-y-4">
            <Button
              onClick={openBillingPortal}
              disabled={portalLoading}
              className="w-full gradient-primary text-white"
              size="lg"
            >
              {portalLoading ? (
                'Opening Portal...'
              ) : (
                <>
                  Open Billing Portal
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
                onClick={() => router.push('/pricing')}
              >
                View Plans
              </Button>
              <Button
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
                onClick={openBillingPortal}
                disabled={portalLoading}
              >
                <Download className="w-4 h-4 mr-2" />
                View Invoices
              </Button>
            </div>
          </div>
        </Card>

        {/* Usage & Limits */}
        <Card variant="glass" className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Calendar className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-semibold text-white">Usage & Limits</h2>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">AI Posts Generated</span>
                <span className="text-white">
                  {usageData?.usage.aiPosts ?? 0} / {usageData?.limits.aiPosts === -1 ? '∞' : (usageData?.limits.aiPosts ?? 10)}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-teal-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${usageData?.limits.aiPosts === -1 ? 0 : (usageData?.percentages.aiPosts ?? 0)}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Social Accounts</span>
                <span className="text-white">
                  {usageData?.usage.socialAccounts ?? 0} / {usageData?.limits.socialAccounts === -1 ? '∞' : (usageData?.limits.socialAccounts ?? 2)}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-teal-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${usageData?.limits.socialAccounts === -1 ? 0 : (usageData?.percentages.socialAccounts ?? 0)}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">AI Personas</span>
                <span className="text-white">
                  {usageData?.usage.personas ?? 0} / {usageData?.limits.personas === -1 ? '∞' : (usageData?.limits.personas ?? 1)}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-teal-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${usageData?.limits.personas === -1 ? 0 : (usageData?.percentages.personas ?? 0)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
            <p className="text-cyan-200 text-sm">
              Need more? <a href="/pricing" className="underline hover:text-cyan-100">Upgrade your plan</a> to unlock higher limits and advanced features.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
