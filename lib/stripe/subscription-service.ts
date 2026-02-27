/**
 * Subscription Service
 *
 * @description Manages user subscriptions and Stripe integration:
 * - Subscription CRUD operations
 * - Plan management
 * - Usage tracking
 * - Webhook event handling
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - STRIPE_SECRET_KEY: Stripe API key (SECRET)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { prisma } from '@/lib/prisma';
import { stripe, PRODUCTS, getProductByPriceId } from './config';
import { logger } from '@/lib/logger';
import { isOwnerEmail } from '@/lib/auth/jwt-utils';
import Stripe from 'stripe';

// ============================================================================
// TYPES
// ============================================================================

export interface SubscriptionInfo {
  id: string;
  userId: string;
  plan: string;
  status: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
  limits: {
    socialAccounts: number;
    aiPosts: number;
    personas: number;
  };
  usage: {
    aiPosts: number;
    lastResetAt: Date;
  };
}

export interface PlanLimits {
  maxSocialAccounts: number;
  maxAiPosts: number;
  maxPersonas: number;
  maxSeoAudits: number;
  maxSeoPages: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: { maxSocialAccounts: 2, maxAiPosts: 10, maxPersonas: 1, maxSeoAudits: 0, maxSeoPages: 0 },
  professional: { maxSocialAccounts: 5, maxAiPosts: 100, maxPersonas: 3, maxSeoAudits: 10, maxSeoPages: 50 },
  business: { maxSocialAccounts: 10, maxAiPosts: -1, maxPersonas: 10, maxSeoAudits: -1, maxSeoPages: -1 }, // -1 = unlimited
  custom: { maxSocialAccounts: -1, maxAiPosts: -1, maxPersonas: -1, maxSeoAudits: -1, maxSeoPages: -1 },
};

// ============================================================================
// SUBSCRIPTION SERVICE CLASS
// ============================================================================

export class SubscriptionService {
  /**
   * Get or create subscription for a user
   */
  async getOrCreateSubscription(userId: string): Promise<SubscriptionInfo> {
    // Owner bypass: platform owners get unlimited (custom) plan
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const ownerBypass = isOwnerEmail(user?.email);

    let subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      const plan = ownerBypass ? 'custom' : 'free';
      const limits = PLAN_LIMITS[plan];
      subscription = await prisma.subscription.create({
        data: {
          userId,
          plan,
          status: 'active',
          maxSocialAccounts: limits.maxSocialAccounts,
          maxAiPosts: limits.maxAiPosts,
          maxPersonas: limits.maxPersonas,
        },
      });
    } else if (ownerBypass && subscription.plan === 'free') {
      // Auto-upgrade existing free subscription for owner
      const limits = PLAN_LIMITS.custom;
      subscription = await prisma.subscription.update({
        where: { userId },
        data: {
          plan: 'custom',
          maxSocialAccounts: limits.maxSocialAccounts,
          maxAiPosts: limits.maxAiPosts,
          maxPersonas: limits.maxPersonas,
        },
      });
    }

    return this.mapToSubscriptionInfo(subscription);
  }

  /**
   * Get subscription by user ID
   */
  async getSubscription(userId: string): Promise<SubscriptionInfo | null> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) return null;

    return this.mapToSubscriptionInfo(subscription);
  }

  /**
   * Get subscription by Stripe customer ID
   */
  async getByStripeCustomerId(customerId: string): Promise<SubscriptionInfo | null> {
    const subscription = await prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!subscription) return null;

    return this.mapToSubscriptionInfo(subscription);
  }

  /**
   * Update subscription from Stripe event
   */
  async updateFromStripeSubscription(
    stripeSubscription: Stripe.Subscription
  ): Promise<SubscriptionInfo> {
    const customerId = stripeSubscription.customer as string;
    const priceId = stripeSubscription.items.data[0]?.price.id;

    // Find subscription by customer ID
    let subscription = await prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!subscription) {
      // Try to find by metadata
      const metadata = stripeSubscription.metadata;
      const userId = metadata?.userId;

      if (userId) {
        subscription = await prisma.subscription.findUnique({
          where: { userId },
        });
      }
    }

    if (!subscription) {
      // Auto-create a subscription record if we have a userId from metadata.
      // This handles the case where the webhook fires before the user ever hit
      // an endpoint that calls getOrCreateSubscription().
      const metaUserId = stripeSubscription.metadata?.userId;
      if (metaUserId) {
        logger.info('Auto-creating subscription record for Stripe customer', { customerId, userId: metaUserId });
        subscription = await prisma.subscription.create({
          data: {
            userId: metaUserId,
            stripeCustomerId: customerId,
            plan: 'free',
            status: 'inactive',
            maxSocialAccounts: PLAN_LIMITS.free.maxSocialAccounts,
            maxAiPosts: PLAN_LIMITS.free.maxAiPosts,
            maxPersonas: PLAN_LIMITS.free.maxPersonas,
          },
        });
      } else {
        logger.warn('No subscription found for Stripe customer and no userId in metadata', { customerId });
        throw new Error('Subscription not found');
      }
    }

    // Determine plan from price ID
    const product = getProductByPriceId(priceId || '');
    const planName = product?.name?.toLowerCase() || 'professional';
    const limits = PLAN_LIMITS[planName] || PLAN_LIMITS.professional;

    // Map Stripe status to our status
    const status = this.mapStripeStatus(stripeSubscription.status);

    // Get current period from the first subscription item
    const firstItem = stripeSubscription.items.data[0];
    const currentPeriodStart = firstItem?.current_period_start;
    const currentPeriodEnd = firstItem?.current_period_end;

    // Update subscription
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: priceId,
        plan: planName,
        status,
        currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart * 1000) : null,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        cancelledAt: stripeSubscription.canceled_at
          ? new Date(stripeSubscription.canceled_at * 1000)
          : null,
        trialStart: stripeSubscription.trial_start
          ? new Date(stripeSubscription.trial_start * 1000)
          : null,
        trialEnd: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
        maxSocialAccounts: limits.maxSocialAccounts,
        maxAiPosts: limits.maxAiPosts,
        maxPersonas: limits.maxPersonas,
      },
    });

    logger.info('Subscription updated from Stripe', {
      subscriptionId: updated.id,
      plan: planName,
      status,
    });

    return this.mapToSubscriptionInfo(updated);
  }

  /**
   * Handle subscription cancellation
   */
  async cancelSubscription(userId: string): Promise<SubscriptionInfo> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription?.stripeSubscriptionId || !stripe) {
      throw new Error('No active subscription to cancel');
    }

    // Cancel at period end in Stripe
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Update local record
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
      },
    });

    logger.info('Subscription marked for cancellation', { userId });

    return this.mapToSubscriptionInfo(updated);
  }

  /**
   * Reactivate a cancelled subscription
   */
  async reactivateSubscription(userId: string): Promise<SubscriptionInfo> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription?.stripeSubscriptionId || !stripe) {
      throw new Error('No subscription to reactivate');
    }

    // Remove cancellation in Stripe
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    // Update local record
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
    });

    logger.info('Subscription reactivated', { userId });

    return this.mapToSubscriptionInfo(updated);
  }

  /**
   * Downgrade to free plan (after cancellation period ends)
   */
  async downgradeToFree(userId: string): Promise<SubscriptionInfo> {
    const limits = PLAN_LIMITS.free;

    const updated = await prisma.subscription.update({
      where: { userId },
      data: {
        plan: 'free',
        status: 'active',
        stripeSubscriptionId: null,
        stripePriceId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        trialStart: null,
        trialEnd: null,
        maxSocialAccounts: limits.maxSocialAccounts,
        maxAiPosts: limits.maxAiPosts,
        maxPersonas: limits.maxPersonas,
      },
    });

    logger.info('Subscription downgraded to free', { userId });

    return this.mapToSubscriptionInfo(updated);
  }

  /**
   * Set Stripe customer ID for a user
   */
  async setStripeCustomerId(userId: string, customerId: string): Promise<void> {
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: customerId,
        plan: 'free',
        status: 'inactive',
      },
      update: {
        stripeCustomerId: customerId,
      },
    });
  }

  // ============================================================================
  // USAGE TRACKING
  // ============================================================================

  /**
   * Check if user can perform an action based on limits
   */
  async checkLimit(
    userId: string,
    resource: 'aiPosts' | 'socialAccounts' | 'personas',
    currentCount?: number
  ): Promise<{ allowed: boolean; limit: number; current: number; remaining: number }> {
    const subscription = await this.getOrCreateSubscription(userId);

    let limit: number;
    let current: number;

    switch (resource) {
      case 'aiPosts':
        limit = subscription.limits.aiPosts;
        current = currentCount ?? subscription.usage.aiPosts;

        // Check if we need to reset monthly usage
        const lastReset = subscription.usage.lastResetAt;
        const now = new Date();
        if (
          lastReset.getMonth() !== now.getMonth() ||
          lastReset.getFullYear() !== now.getFullYear()
        ) {
          await this.resetUsage(userId);
          current = 0;
        }
        break;

      case 'socialAccounts':
        limit = subscription.limits.socialAccounts;
        current = currentCount ?? await prisma.platformConnection.count({
          where: { userId, isActive: true },
        });
        break;

      case 'personas':
        limit = subscription.limits.personas;
        current = currentCount ?? await prisma.persona.count({
          where: { userId, status: { not: 'archived' } },
        });
        break;
    }

    // -1 means unlimited
    const allowed = limit === -1 || current < limit;
    const remaining = limit === -1 ? Infinity : Math.max(0, limit - current);

    return { allowed, limit, current, remaining };
  }

  /**
   * Increment usage counter
   */
  async incrementUsage(userId: string, resource: 'aiPosts', amount: number = 1): Promise<void> {
    await prisma.subscription.update({
      where: { userId },
      data: {
        currentAiPosts: { increment: amount },
      },
    });
  }

  /**
   * Reset monthly usage
   */
  async resetUsage(userId: string): Promise<void> {
    await prisma.subscription.update({
      where: { userId },
      data: {
        currentAiPosts: 0,
        lastResetAt: new Date(),
      },
    });
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
    const statusMap: Record<Stripe.Subscription.Status, string> = {
      active: 'active',
      canceled: 'cancelled',
      incomplete: 'inactive',
      incomplete_expired: 'inactive',
      past_due: 'past_due',
      trialing: 'trialing',
      unpaid: 'past_due',
      paused: 'inactive',
    };

    return statusMap[stripeStatus] || 'inactive';
  }

  private mapToSubscriptionInfo(subscription: {
    id: string;
    userId: string;
    plan: string;
    status: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    trialEnd: Date | null;
    maxSocialAccounts: number;
    maxAiPosts: number;
    maxPersonas: number;
    currentAiPosts: number;
    lastResetAt: Date;
  }): SubscriptionInfo {
    return {
      id: subscription.id,
      userId: subscription.userId,
      plan: subscription.plan,
      status: subscription.status,
      stripeCustomerId: subscription.stripeCustomerId || undefined,
      stripeSubscriptionId: subscription.stripeSubscriptionId || undefined,
      currentPeriodStart: subscription.currentPeriodStart || undefined,
      currentPeriodEnd: subscription.currentPeriodEnd || undefined,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEnd: subscription.trialEnd || undefined,
      limits: {
        socialAccounts: subscription.maxSocialAccounts,
        aiPosts: subscription.maxAiPosts,
        personas: subscription.maxPersonas,
      },
      usage: {
        aiPosts: subscription.currentAiPosts,
        lastResetAt: subscription.lastResetAt,
      },
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const subscriptionService = new SubscriptionService();
export default subscriptionService;
