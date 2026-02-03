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
import { auditLogger } from '@/lib/security/audit-logger';
import { logger } from '@/lib/logger';
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
  const parent = invoice.parent as { subscription_details?: { subscription?: string | Stripe.Subscription } } | null;
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
    await subscriptionService.updateFromStripeSubscription(subscription);

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

    // TODO: Send payment confirmation email
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

    // TODO: Send payment failed notification email
    // TODO: Consider updating subscription status to past_due
  } catch (error) {
    logger.error('Failed to handle payment failed', {
      error,
      invoiceId: invoice.id,
    });
    throw error;
  }
}

// ============================================================================
// REGISTER HANDLERS
// ============================================================================

export function registerStripeWebhookHandlers(): void {
  // Subscription events
  webhookHandler.on('billing.subscription_created', handleSubscriptionCreated);
  webhookHandler.on('billing.subscription_updated', handleSubscriptionUpdated);
  webhookHandler.on('billing.subscription_cancelled', handleSubscriptionCancelled);

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
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionCancelled,
  handlePaymentSucceeded,
  handlePaymentFailed,
};
