'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from './use-user';

export interface SubscriptionData {
  id: string;
  plan: 'free' | 'pro' | 'growth' | 'scale' | 'professional' | 'business' | 'custom';
  status: string;
  limits: {
    socialAccounts: number;
    aiPosts: number;
    personas: number;
    seoAudits: number;
    seoPages: number;
  };
  usage: {
    aiPosts: number;
    seoAudits: number;
    seoPages: number;
  };
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: string;
}

interface UseSubscriptionReturn {
  subscription: SubscriptionData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  hasAccess: (requiredPlan: 'free' | 'pro' | 'growth' | 'scale' | 'professional' | 'business' | 'custom') => boolean;
}

const PLAN_HIERARCHY = ['free', 'pro', 'growth', 'scale', 'professional', 'business', 'custom'];

/**
 * Custom hook to get the current user's subscription
 */
export function useSubscription(): UseSubscriptionReturn {
  const { user, isLoading: userLoading } = useUser();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/user/subscription', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }

      const data = await response.json();

      // Add SEO defaults if not present
      setSubscription({
        ...data,
        limits: {
          ...data.limits,
          seoAudits: data.limits?.seoAudits ?? (data.plan === 'free' ? 0 : (data.plan === 'pro' || data.plan === 'professional') ? 10 : -1),
          seoPages: data.limits?.seoPages ?? (data.plan === 'free' ? 0 : (data.plan === 'pro' || data.plan === 'professional') ? 50 : -1),
        },
        usage: {
          ...data.usage,
          seoAudits: data.usage?.seoAudits ?? 0,
          seoPages: data.usage?.seoPages ?? 0,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch subscription'));
      // Set default free subscription on error
      setSubscription({
        id: '',
        plan: 'free',
        status: 'active',
        limits: { socialAccounts: 2, aiPosts: 10, personas: 1, seoAudits: 0, seoPages: 0 },
        usage: { aiPosts: 0, seoAudits: 0, seoPages: 0 },
        cancelAtPeriodEnd: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!userLoading) {
      fetchSubscription();
    }
  }, [userLoading, fetchSubscription]);

  const hasAccess = useCallback(
    (requiredPlan: 'free' | 'pro' | 'growth' | 'scale' | 'professional' | 'business' | 'custom') => {
      if (!subscription) return false;
      const userPlanIndex = PLAN_HIERARCHY.indexOf(subscription.plan);
      const requiredPlanIndex = PLAN_HIERARCHY.indexOf(requiredPlan);
      return userPlanIndex >= requiredPlanIndex;
    },
    [subscription]
  );

  return {
    subscription,
    isLoading: isLoading || userLoading,
    error,
    refetch: fetchSubscription,
    hasAccess,
  };
}

export default useSubscription;
