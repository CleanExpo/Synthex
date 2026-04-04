/**
 * MRR (Monthly Recurring Revenue) Calculator
 *
 * Calculates MRR from two sources:
 * 1. Stripe API (primary) -- real subscription amounts from Stripe
 * 2. Plan-based estimate (fallback) -- derived from DB plan tiers + PRODUCTS config prices
 *
 * Server-side caching with 5-minute TTL prevents excessive Stripe API calls.
 * Yearly subscriptions are divided by 12 for monthly revenue.
 *
 * @module lib/admin/mrr-calculator
 * @see SYN-18
 */

import Stripe from 'stripe';
import { stripe, PRODUCTS } from '@/lib/stripe/config';
import prisma from '@/lib/prisma';

// =============================================================================
// Types
// =============================================================================

export interface MRRResult {
  /** Real MRR from Stripe API (AUD dollars) */
  stripeMrr: number;
  /** Plan-based estimate from DB (AUD dollars) */
  estimatedMrr: number;
  /** Currency code */
  currency: string;
  /** Number of active subscriptions from Stripe */
  activeCount: number;
  /** ISO timestamp of when MRR was calculated */
  calculatedAt: string;
}

// =============================================================================
// In-memory cache with TTL
// =============================================================================

let cachedResult: MRRResult | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// Plan price mapping (DB plan name -> AUD monthly price)
// =============================================================================

const PLAN_PRICES: Record<string, number> = {
  pro: PRODUCTS.pro.price,
  professional: PRODUCTS.pro.price,
  growth: PRODUCTS.growth.price,
  business: PRODUCTS.growth.price,
  scale: PRODUCTS.scale.price,
  custom: PRODUCTS.scale.price,
};

// =============================================================================
// Main calculator
// =============================================================================

/**
 * Calculate MRR from Stripe API (if configured) and plan-based DB estimate.
 * Results are cached for 5 minutes to avoid Stripe rate limit pressure.
 */
export async function calculateMRR(): Promise<MRRResult> {
  const now = Date.now();
  if (cachedResult && now - cachedAt < CACHE_TTL_MS) {
    return cachedResult;
  }

  let stripeMrr = 0;
  let activeCount = 0;

  // -------------------------------------------------------------------------
  // 1. Real Stripe MRR (if configured)
  // -------------------------------------------------------------------------
  if (stripe) {
    try {
      const subscriptions = await stripe.subscriptions.list({
        status: 'active',
        limit: 100,
        expand: ['data.items.data.price'],
      });

      for (const sub of subscriptions.data) {
        for (const item of sub.items.data) {
          if (item.price?.unit_amount) {
            const interval = item.price.recurring?.interval;
            const amount = item.price.unit_amount / 100;
            // Yearly plans: divide by 12 to get monthly equivalent
            if (interval === 'year') {
              stripeMrr += amount / 12;
            } else {
              stripeMrr += amount;
            }
          }
        }
        activeCount++;
      }

      // Handle pagination if > 100 subscriptions
      if (subscriptions.has_more) {
        let lastId: string | undefined = subscriptions.data[subscriptions.data.length - 1]?.id;
        while (lastId) {
          const more: Stripe.ApiList<Stripe.Subscription> = await stripe.subscriptions.list({
            status: 'active',
            limit: 100,
            starting_after: lastId,
            expand: ['data.items.data.price'],
          });
          for (const sub of more.data) {
            for (const item of sub.items.data) {
              if (item.price?.unit_amount) {
                const interval = item.price.recurring?.interval;
                const amount = item.price.unit_amount / 100;
                if (interval === 'year') {
                  stripeMrr += amount / 12;
                } else {
                  stripeMrr += amount;
                }
              }
            }
            activeCount++;
          }
          lastId = more.has_more
            ? more.data[more.data.length - 1]?.id
            : undefined;
        }
      }
    } catch (error) {
      console.error('Failed to fetch Stripe MRR:', error);
      // Fall through to plan-based estimate
    }
  }

  // -------------------------------------------------------------------------
  // 2. Plan-based estimate from DB (fallback or comparison)
  // -------------------------------------------------------------------------
  const planCounts = await prisma.subscription.groupBy({
    by: ['plan'],
    where: { status: 'active' },
    _count: { plan: true },
  });

  let estimatedMrr = 0;
  for (const row of planCounts) {
    const price = PLAN_PRICES[row.plan] ?? 0;
    estimatedMrr += price * row._count.plan;
  }

  // -------------------------------------------------------------------------
  // 3. Build result + cache
  // -------------------------------------------------------------------------
  const result: MRRResult = {
    stripeMrr: Math.round(stripeMrr * 100) / 100,
    estimatedMrr: Math.round(estimatedMrr * 100) / 100,
    currency: 'aud',
    activeCount,
    calculatedAt: new Date().toISOString(),
  };

  cachedResult = result;
  cachedAt = now;
  return result;
}
