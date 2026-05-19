/**
 * Stripe Webhook Event Handlers
 *
 * @description Processes Stripe webhook events:
 * - Subscription created/updated/cancelled
 * - Payment succeeded/failed
 * - Customer events
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { WebhookEvent } from '@/lib/webhooks/types';
import { webhookHandler } from '@/lib/webhooks/webhook-handler';
import { subscriptionService } from './subscription-service';
import { stripe, PRODUCTS } from './config';
import { auditLogger } from '@/lib/security/audit-logger';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import {
  sendPaymentReceiptEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCancelledEmail,
} from '@/lib/email/billing-emails';
import { pushUniteHubEvent } from '@/lib/unite-hub-connector';
import Stripe from 'stripe';

// ============================================================================
// TYPES
// ============================================================================

interface StripeWebhookData {
  id: string;
  object: string;
  type: string;
  data: {
    object: Stripe.Subscription | Stripe.Invoice | Stripe.Customer;
  };
}

// Extended Invoice type to include subscription field that may exist in webhook payloads
interface InvoiceWithSubscription extends Stripe.Invoice {
  subscription?: string | Stripe.Subscription | null;
}

/**
 * Safely cast event data to StripeWebhookData
 */
function getWebhookData(event: WebhookEvent): StripeWebhookData {
  return event.data as unknown as StripeWebhookData;
}

/**
 * Get subscription ID from invoice (handles different Stripe API versions)
 */
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  // Try direct subscription field (older API versions)
  const invoiceExt = invoice as InvoiceWithSubscription;
  if (invoiceExt.subscription) {
    return typeof invoiceExt.subscription === 'string'
      ? invoiceExt.subscription
      : invoiceExt.subscription.id;
  }

  // Try parent.subscription_details (newer API versions)
  const parent = invoice.parent as {
    subscription_details?: { subscription?: string | Stripe.Subscription };
  } | null;
  if (parent?.subscription_details?.subscription) {
    return typeof parent.subscription_details.subscription === 'string'
      ? parent.subscription_details.subscription
      : parent.subscription_details.subscription.id;
  }

  return null;
}

// ============================================================================
// SUBSCRIPTION HANDLERS
// ============================================================================

/**
 * Handle subscription created
 */
async function handleSubscriptionCreated(event: WebhookEvent): Promise<void> {
  const data = getWebhookData(event);
  const subscription = data.data.object as Stripe.Subscription;

  logger.info('Handling subscription created', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
  });

  try {
    await subscriptionService.updateFromStripeSubscription(subscription);

    await auditLogger.log({
      action: 'billing.subscription_created',
      resource: 'subscription',
      resourceId: subscription.id,
      category: 'compliance',
      severity: 'medium',
      outcome: 'success',
      details: {
        customerId: subscription.customer,
        priceId: subscription.items.data[0]?.price.id,
        status: subscription.status,
      },
    });
  } catch (error) {
    logger.error('Failed to handle subscription created', {
      error,
      subscriptionId: subscription.id,
    });
    throw error;
  }
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(event: WebhookEvent): Promise<void> {
  const data = getWebhookData(event);
  const subscription = data.data.object as Stripe.Subscription;

  logger.info('Handling subscription updated', {
    subscriptionId: subscription.id,
    status: subscription.status,
  });

  try {
    // Capture old plan before updating, for user.upgrade event
    const existingSub = await subscriptionService.getByStripeCustomerId(
      subscription.customer as string
    );
    const oldPlan = existingSub?.plan;

    await subscriptionService.updateFromStripeSubscription(subscription);

    // Fetch updated sub to get new plan name
    const updatedSub = await subscriptionService.getByStripeCustomerId(
      subscription.customer as string
    );
    const newPlan = updatedSub?.plan;

    // Push user.upgrade event if plan actually changed (fire-and-forget)
    if (oldPlan && newPlan && oldPlan !== newPlan && existingSub?.userId) {
      void pushUniteHubEvent({
        type: 'user.upgrade',
        userId: existingSub.userId,
        fromPlan: oldPlan,
        toPlan: newPlan,
      });
    }

    await auditLogger.log({
      action: 'billing.subscription_updated',
      resource: 'subscription',
      resourceId: subscription.id,
      category: 'compliance',
      severity: 'low',
      outcome: 'success',
      details: {
        customerId: subscription.customer,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  } catch (error) {
    logger.error('Failed to handle subscription updated', {
      error,
      subscriptionId: subscription.id,
    });
    throw error;
  }
}

/**
 * Handle subscription cancelled
 */
async function handleSubscriptionCancelled(event: WebhookEvent): Promise<void> {
  const data = getWebhookData(event);
  const subscription = data.data.object as Stripe.Subscription;

  logger.info('Handling subscription cancelled', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
  });

  try {
    // Get the subscription from our database
    const existingSub = await subscriptionService.getByStripeCustomerId(
      subscription.customer as string
    );

    if (existingSub) {
      // Downgrade to free plan
      await subscriptionService.downgradeToFree(existingSub.userId);

      // Push user.churn event to Unite-Hub (fire-and-forget)
      void pushUniteHubEvent({
        type: 'user.churn',
        userId: existingSub.userId,
        plan: existingSub.plan,
      });

      // Send cancellation email (fire-and-forget — do not await)
      const user = await prisma.user.findUnique({
        where: { id: existingSub.userId },
        select: { email: true, name: true },
      });
      if (user?.email) {
        // Format the period end date (DD/MM/YYYY per project convention)
        // current_period_end lives on the subscription item in newer Stripe API versions
        const firstItemPeriodEnd =
          subscription.items.data[0]?.current_period_end;
        const periodEnd = subscription.cancel_at
          ? new Date(subscription.cancel_at * 1000)
          : firstItemPeriodEnd
            ? new Date(firstItemPeriodEnd * 1000)
            : null;
        const endDate = periodEnd
          ? periodEnd.toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          : 'the end of your billing period';
        sendSubscriptionCancelledEmail({
          email: user.email,
          name: user.name ?? undefined,
          plan: existingSub.plan,
          endDate,
        });
      }
    }

    await auditLogger.log({
      action: 'billing.subscription_cancelled',
      resource: 'subscription',
      resourceId: subscription.id,
      category: 'compliance',
      severity: 'high',
      outcome: 'success',
      details: {
        customerId: subscription.customer,
        reason: subscription.cancellation_details?.reason,
      },
    });
  } catch (error) {
    logger.error('Failed to handle subscription cancelled', {
      error,
      subscriptionId: subscription.id,
    });
    throw error;
  }
}

// ============================================================================
// PAYMENT HANDLERS
// ============================================================================

/**
 * Handle payment succeeded
 */
async function handlePaymentSucceeded(event: WebhookEvent): Promise<void> {
  const data = getWebhookData(event);
  const invoice = data.data.object as Stripe.Invoice;

  logger.info('Handling payment succeeded', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    amount: invoice.amount_paid,
  });

  try {
    await auditLogger.log({
      action: 'billing.payment_succeeded',
      resource: 'invoice',
      resourceId: invoice.id,
      category: 'compliance',
      severity: 'medium',
      outcome: 'success',
      details: {
        customerId: invoice.customer,
        amountPaid: invoice.amount_paid,
        currency: invoice.currency,
        subscriptionId: getSubscriptionIdFromInvoice(invoice),
      },
    });

    // Send payment receipt email (fire-and-forget — do not await)
    const subRecord = await subscriptionService.getByStripeCustomerId(
      invoice.customer as string
    );
    if (subRecord) {
      // PR 3 — mark any prior DunningState as recovered. Only acts if a row
      // exists; happy-path subscriptions never produce a dunning row.
      try {
        const existing = await prisma.dunningState.findUnique({
          where: { subscriptionId: subRecord.id },
        });
        if (
          existing &&
          (existing.state === 'past_due' || existing.state === 'unpaid')
        ) {
          await prisma.dunningState.update({
            where: { subscriptionId: subRecord.id },
            data: {
              state: 'recovered',
              recoveredAt: new Date(),
              nextRetryAt: null,
            },
          });
        }
      } catch (dunningError) {
        logger.error('Failed to mark DunningState as recovered', {
          error: dunningError,
          subscriptionId: subRecord.id,
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: subRecord.userId },
        select: { email: true, name: true },
      });
      if (user?.email) {
        sendPaymentReceiptEmail({
          email: user.email,
          name: user.name ?? undefined,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          plan: subRecord.plan,
          billingPortalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social'}/dashboard/billing`,
        });
      }

      // Push payment.received event to Unite-Hub (fire-and-forget)
      void pushUniteHubEvent({
        type: 'payment.received',
        userId: subRecord.userId,
        amount: invoice.amount_paid,
        currency: invoice.currency,
      });
    }
  } catch (error) {
    logger.error('Failed to handle payment succeeded', {
      error,
      invoiceId: invoice.id,
    });
    throw error;
  }
}

/**
 * Handle payment failed
 */
async function handlePaymentFailed(event: WebhookEvent): Promise<void> {
  const data = getWebhookData(event);
  const invoice = data.data.object as Stripe.Invoice;

  logger.warn('Handling payment failed', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
  });

  try {
    await auditLogger.log({
      action: 'billing.payment_failed',
      resource: 'invoice',
      resourceId: invoice.id,
      category: 'compliance',
      severity: 'high',
      outcome: 'failure',
      details: {
        customerId: invoice.customer,
        amountDue: invoice.amount_due,
        currency: invoice.currency,
        subscriptionId: getSubscriptionIdFromInvoice(invoice),
        attemptCount: invoice.attempt_count,
      },
    });

    // Send payment failed alert email (fire-and-forget — do not await)
    const subRecord = await subscriptionService.getByStripeCustomerId(
      invoice.customer as string
    );
    if (subRecord) {
      // PR 3 — upsert DunningState. `unpaid` after Stripe's default 4 retries
      // have been exhausted (attempt_count >= 4); otherwise `past_due`.
      const attemptCount = invoice.attempt_count ?? 0;
      const dunningStateValue: 'past_due' | 'unpaid' =
        attemptCount >= 4 ? 'unpaid' : 'past_due';
      const nextAttemptAt = invoice.next_payment_attempt
        ? new Date(invoice.next_payment_attempt * 1000)
        : null;
      const now = new Date();

      try {
        await prisma.dunningState.upsert({
          where: { subscriptionId: subRecord.id },
          create: {
            subscriptionId: subRecord.id,
            state: dunningStateValue,
            failedAttempts: attemptCount || 1,
            nextRetryAt: nextAttemptAt,
            lastFailureAt: now,
          },
          update: {
            state: dunningStateValue,
            // Stripe's invoice.attempt_count is the authoritative counter.
            failedAttempts: attemptCount || 1,
            nextRetryAt: nextAttemptAt,
            lastFailureAt: now,
            // Clear recoveredAt — a new failure has occurred.
            recoveredAt: null,
          },
        });
      } catch (dunningError) {
        // Log but do not throw — dunning tracking failure must not block the
        // primary webhook acknowledgement to Stripe.
        logger.error('Failed to upsert DunningState', {
          error: dunningError,
          subscriptionId: subRecord.id,
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: subRecord.userId },
        select: { email: true, name: true },
      });
      if (user?.email) {
        sendPaymentFailedEmail({
          email: user.email,
          name: user.name ?? undefined,
          amount: invoice.amount_due,
          currency: invoice.currency,
          billingPortalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social'}/dashboard/billing`,
        });
      }
    }
  } catch (error) {
    logger.error('Failed to handle payment failed', {
      error,
      invoiceId: invoice.id,
    });
    throw error;
  }
}

// ============================================================================
// CHECKOUT HANDLERS
// ============================================================================

/**
 * Handle checkout session completed
 *
 * Links Stripe customer ID to the user's subscription record so that
 * subsequent subscription webhooks can find it by customerId.
 */
async function handleCheckoutCompleted(event: WebhookEvent): Promise<void> {
  const data = getWebhookData(event);
  const session = data.data.object as unknown as Record<string, unknown>;

  const customerId = session.customer as string;
  const userId =
    (session.client_reference_id as string) ||
    (session.metadata as Record<string, string>)?.userId;

  logger.info('Handling checkout completed', {
    sessionId: session.id,
    customerId,
    userId,
  });

  if (!userId || !customerId) {
    logger.warn('Checkout completed missing userId or customerId', {
      session: session.id,
    });
    return;
  }

  try {
    // Ensure subscription record exists and has the Stripe customer ID
    await subscriptionService.setStripeCustomerId(userId, customerId);

    // If this is an introductory plan checkout, create a Subscription Schedule
    // so Stripe automatically transitions to the full price after 2 billing cycles.
    const sessionMeta = session.metadata as Record<string, string> | undefined;
    if (sessionMeta?.isIntroductory === 'true' && stripe) {
      const subscriptionId = session.subscription as string | undefined;
      if (subscriptionId) {
        const intro = PRODUCTS.introductory;
        // Guard: only create schedule if both price IDs are real (not placeholders)
        if (
          !intro.priceId.includes('placeholder') &&
          !intro.transitionToPriceId.includes('placeholder')
        ) {
          try {
            await stripe.subscriptionSchedules.create({
              from_subscription: subscriptionId,
              end_behavior: 'release',
              phases: [
                {
                  items: [{ price: intro.priceId, quantity: 1 }],
                  iterations: intro.transitionAfterCycles, // 2 billing cycles at $99
                },
                {
                  items: [{ price: intro.transitionToPriceId, quantity: 1 }],
                  // No end_date — continues indefinitely at $249
                },
              ],
            });
            logger.info('Introductory subscription schedule created', {
              subscriptionId,
              userId,
              introPriceId: intro.priceId,
              regularPriceId: intro.transitionToPriceId,
              transitionAfterCycles: intro.transitionAfterCycles,
            });
          } catch (scheduleError) {
            // Non-fatal — subscription still active at $99; log for manual follow-up
            logger.error(
              'Failed to create introductory subscription schedule',
              {
                scheduleError,
                subscriptionId,
                userId,
              }
            );
          }
        }
      }
    }

    // Fetch plan details for Unite-Hub event
    const userSub = await subscriptionService.getByStripeCustomerId(customerId);
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    // Push user.signup event to Unite-Hub (fire-and-forget)
    void pushUniteHubEvent({
      type: 'user.signup',
      userId,
      plan: userSub?.plan ?? 'unknown',
      email: userRecord?.email ?? '',
    });

    await auditLogger.log({
      action: 'billing.checkout_completed',
      resource: 'checkout_session',
      resourceId: session.id as string,
      userId,
      category: 'compliance',
      severity: 'medium',
      outcome: 'success',
      details: {
        customerId,
        subscriptionId: session.subscription,
        isIntroductory: sessionMeta?.isIntroductory === 'true',
      },
    });
  } catch (error) {
    logger.error('Failed to handle checkout completed', {
      error,
      sessionId: session.id,
    });
    throw error;
  }
}

// ============================================================================
// REGISTER HANDLERS
// ============================================================================

export function registerStripeWebhookHandlers(): void {
  // Checkout events
  webhookHandler.on('billing.checkout_completed', handleCheckoutCompleted);

  // Subscription events
  webhookHandler.on('billing.subscription_created', handleSubscriptionCreated);
  webhookHandler.on('billing.subscription_updated', handleSubscriptionUpdated);
  webhookHandler.on(
    'billing.subscription_cancelled',
    handleSubscriptionCancelled
  );

  // Payment events
  webhookHandler.on('billing.payment_succeeded', handlePaymentSucceeded);
  webhookHandler.on('billing.payment_failed', handlePaymentFailed);

  logger.info('Stripe webhook handlers registered');
}

// Auto-register handlers on import
registerStripeWebhookHandlers();

// ============================================================================
// EXPORTS
// ============================================================================

export {
  handleCheckoutCompleted,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionCancelled,
  handlePaymentSucceeded,
  handlePaymentFailed,
};
