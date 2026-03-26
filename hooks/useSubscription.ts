'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { useUser } from './use-user';

export interface SubscriptionData {
  id: string;
  plan:
    | 'free'
    | 'starter'
    | 'pro'
    | 'growth'
    | 'scale'
    | 'professional'
    | 'business'
    | 'custom';
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
  hasAccess: (
    requiredPlan:
      | 'free'
      | 'starter'
      | 'pro'
      | 'growth'
      | 'scale'
      | 'professional'
      | 'business'
      | 'custom'
  ) => boolean;
}

const PLAN_HIERARCHY = [
  'free',
  'starter',
  'pro',
  'growth',
  'scale',
  'professional',
  'business',
  'custom',
];

const DEFAULT_FREE_SUBSCRIPTION: SubscriptionData = {
  id: '',
  plan: 'free',
  status: 'active',
  limits: {
    socialAccounts: 2,
    aiPosts: 10,
    personas: 1,
    seoAudits: 0,
    seoPages: 0,
  },
  usage: { aiPosts: 0, seoAudits: 0, seoPages: 0 },
  cancelAtPeriodEnd: false,
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to fetch subscription');
  const data = await res.json();
  // Normalise SEO fields that may be absent on older records
  return {
    ...data,
    limits: {
      ...data.limits,
      seoAudits:
        data.limits?.seoAudits ??
        (data.plan === 'free'
          ? 0
          : data.plan === 'pro' || data.plan === 'professional'
            ? 10
            : -1),
      seoPages:
        data.limits?.seoPages ??
        (data.plan === 'free'
          ? 0
          : data.plan === 'pro' || data.plan === 'professional'
            ? 50
            : -1),
    },
    usage: {
      ...data.usage,
      seoAudits: data.usage?.seoAudits ?? 0,
      seoPages: data.usage?.seoPages ?? 0,
    },
  } as T;
}

/**
 * Custom hook to get the current user's subscription
 */
export function useSubscription(): UseSubscriptionReturn {
  const { user, isLoading: userLoading } = useUser();

  const { data, error, isLoading, mutate } = useSWR<SubscriptionData>(
    !userLoading && user ? '/api/user/subscription' : null,
    fetchJson,
    {
      revalidateOnFocus: false,
      // Fall back to free plan on fetch error so the UI never breaks
      onErrorRetry: (_err, _key, _config, revalidate, { retryCount }) => {
        if (retryCount >= 2) return;
        setTimeout(() => revalidate({ retryCount }), 5000);
      },
    }
  );

  const refetch = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const hasAccess = useCallback(
    (
      requiredPlan:
        | 'free'
        | 'starter'
        | 'pro'
        | 'growth'
        | 'scale'
        | 'professional'
        | 'business'
        | 'custom'
    ) => {
      const subscription = data ?? (error ? DEFAULT_FREE_SUBSCRIPTION : null);
      if (!subscription) return false;
      const userPlanIndex = PLAN_HIERARCHY.indexOf(subscription.plan);
      const requiredPlanIndex = PLAN_HIERARCHY.indexOf(requiredPlan);
      return userPlanIndex >= requiredPlanIndex;
    },
    [data, error]
  );

  // When user is not logged in, subscription is null with no loading
  const subscription =
    !userLoading && !user
      ? null
      : (data ?? (error ? DEFAULT_FREE_SUBSCRIPTION : null));

  return {
    subscription,
    isLoading: userLoading || isLoading,
    error:
      error instanceof Error
        ? error
        : error
          ? new Error('Failed to fetch subscription')
          : null,
    refetch,
    hasAccess,
  };
}

export default useSubscription;
