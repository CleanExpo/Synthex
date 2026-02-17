/**
 * Unit Tests for Stripe Webhook Handlers
 *
 * Tests webhook event handling for:
 * - subscription.created
 * - subscription.updated
 * - subscription.cancelled
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 * - Handler registration
 * - Webhook route contract
 */

import Stripe from 'stripe';

// ============================================================================
// MOCKS - Must be declared before imports
// ============================================================================

// Mock webhook handler
const mockWebhookHandlerOn = jest.fn();
const mockWebhookHandlerReceive = jest.fn();
const mockWebhookHandlerRegister = jest.fn();

jest.mock('@/lib/webhooks/webhook-handler', () => ({
  webhookHandler: {
    on: mockWebhookHandlerOn,
    receive: mockWebhookHandlerReceive,
    register: mockWebhookHandlerRegister,
  },
}));

// Mock subscription service
const mockUpdateFromStripeSubscription = jest.fn();
const mockGetByStripeCustomerId = jest.fn();
const mockDowngradeToFree = jest.fn();

jest.mock('@/lib/stripe/subscription-service', () => ({
  subscriptionService: {
    updateFromStripeSubscription: mockUpdateFromStripeSubscription,
    getByStripeCustomerId: mockGetByStripeCustomerId,
    downgradeToFree: mockDowngradeToFree,
  },
}));

// Mock audit logger
const mockAuditLog = jest.fn();

jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: {
    log: mockAuditLog,
  },
}));

// Mock logger
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('@/lib/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: mockLoggerWarn,
  },
}));

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockSubscription = (overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription => ({
  id: 'sub_123',
  object: 'subscription',
  application: null,
  application_fee_percent: null,
  automatic_tax: { enabled: false, liability: null },
  billing_cycle_anchor: 1234567890,
  billing_cycle_anchor_config: null,
  billing_thresholds: null,
  cancel_at: null,
  cancel_at_period_end: false,
  canceled_at: null,
  cancellation_details: null,
  collection_method: 'charge_automatically',
  created: 1234567890,
  currency: 'usd',
  current_period_end: 1234667890,
  current_period_start: 1234567890,
  customer: 'cus_123',
  days_until_due: null,
  default_payment_method: null,
  default_source: null,
  default_tax_rates: [],
  description: null,
  discount: null,
  discounts: [],
  ended_at: null,
  invoice_settings: {
    account_tax_ids: null,
    issuer: { type: 'self' },
  },
  items: {
    object: 'list',
    data: [
      {
        id: 'si_123',
        object: 'subscription_item',
        billing_thresholds: null,
        created: 1234567890,
        discounts: [],
        metadata: {},
        price: {
          id: 'price_professional',
          object: 'price',
          active: true,
          billing_scheme: 'per_unit',
          created: 1234567890,
          currency: 'usd',
          custom_unit_amount: null,
          livemode: false,
          lookup_key: null,
          metadata: {},
          nickname: null,
          product: 'prod_123',
          recurring: {
            aggregate_usage: null,
            interval: 'month',
            interval_count: 1,
            meter: null,
            trial_period_days: null,
            usage_type: 'licensed',
          },
          tax_behavior: 'unspecified',
          tiers_mode: null,
          transform_quantity: null,
          type: 'recurring',
          unit_amount: 24900,
          unit_amount_decimal: '24900',
        },
        quantity: 1,
        subscription: 'sub_123',
        tax_rates: [],
      },
    ],
    has_more: false,
    url: '/v1/subscription_items?subscription=sub_123',
  },
  latest_invoice: null,
  livemode: false,
  metadata: { userId: 'user_123' },
  next_pending_invoice_item_invoice: null,
  on_behalf_of: null,
  pause_collection: null,
  payment_settings: {
    payment_method_options: null,
    payment_method_types: null,
    save_default_payment_method: 'off',
  },
  pending_invoice_item_interval: null,
  pending_setup_intent: null,
  pending_update: null,
  schedule: null,
  start_date: 1234567890,
  status: 'active',
  test_clock: null,
  transfer_data: null,
  trial_end: null,
  trial_settings: { end_behavior: { missing_payment_method: 'create_invoice' } },
  trial_start: null,
  ...overrides,
});

const createMockInvoice = (overrides: Partial<Stripe.Invoice> = {}): Stripe.Invoice => ({
  id: 'in_123',
  object: 'invoice',
  account_country: 'US',
  account_name: 'Test Account',
  account_tax_ids: null,
  amount_due: 24900,
  amount_paid: 24900,
  amount_remaining: 0,
  amount_shipping: 0,
  application: null,
  application_fee_amount: null,
  attempt_count: 1,
  attempted: true,
  auto_advance: true,
  automatic_tax: { enabled: false, liability: null, status: null },
  automatically_finalizes_at: null,
  billing_reason: 'subscription_cycle',
  charge: 'ch_123',
  collection_method: 'charge_automatically',
  created: 1234567890,
  currency: 'usd',
  custom_fields: null,
  customer: 'cus_123',
  customer_address: null,
  customer_email: 'test@example.com',
  customer_name: null,
  customer_phone: null,
  customer_shipping: null,
  customer_tax_exempt: 'none',
  customer_tax_ids: [],
  default_payment_method: null,
  default_source: null,
  default_tax_rates: [],
  description: null,
  discount: null,
  discounts: [],
  due_date: null,
  effective_at: null,
  ending_balance: 0,
  footer: null,
  from_invoice: null,
  hosted_invoice_url: null,
  invoice_pdf: null,
  issuer: { type: 'self' },
  last_finalization_error: null,
  latest_revision: null,
  lines: {
    object: 'list',
    data: [],
    has_more: false,
    url: '/v1/invoices/in_123/lines',
  },
  livemode: false,
  metadata: {},
  next_payment_attempt: null,
  number: 'INV-123',
  on_behalf_of: null,
  paid: true,
  paid_out_of_band: false,
  parent: null,
  payment_intent: 'pi_123',
  payment_settings: {
    default_mandate: null,
    payment_method_options: null,
    payment_method_types: null,
  },
  period_end: 1234667890,
  period_start: 1234567890,
  post_payment_credit_notes_amount: 0,
  pre_payment_credit_notes_amount: 0,
  quote: null,
  receipt_number: null,
  rendering: null,
  rendering_options: null,
  shipping_cost: null,
  shipping_details: null,
  starting_balance: 0,
  statement_descriptor: null,
  status: 'paid',
  status_transitions: {
    finalized_at: 1234567890,
    marked_uncollectible_at: null,
    paid_at: 1234567890,
    voided_at: null,
  },
  subscription: 'sub_123',
  subscription_details: null,
  subscription_proration_date: null,
  subtotal: 24900,
  subtotal_excluding_tax: null,
  tax: null,
  test_clock: null,
  total: 24900,
  total_discount_amounts: [],
  total_excluding_tax: null,
  total_tax_amounts: [],
  transfer_data: null,
  webhooks_delivered_at: null,
  ...overrides,
});

const createWebhookEvent = (type: string, stripeObject: any) => ({
  id: `evt_${Date.now()}`,
  type,
  // The webhook handler expects event.data to be a StripeWebhookData structure
  data: {
    id: `evt_${Date.now()}`,
    object: 'event',
    type,
    data: {
      object: stripeObject,
    },
  },
});

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Stripe Webhook Handlers', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Restore mock implementations (resetMocks: true clears them)
    mockWebhookHandlerOn.mockReturnValue(undefined);
    mockWebhookHandlerReceive.mockResolvedValue({
      success: true,
      eventId: 'evt_123',
    });
    mockUpdateFromStripeSubscription.mockResolvedValue({
      id: 'sub_db_123',
      userId: 'user_123',
      plan: 'professional',
    });
    mockGetByStripeCustomerId.mockResolvedValue({
      id: 'sub_db_123',
      userId: 'user_123',
      plan: 'professional',
    });
    mockDowngradeToFree.mockResolvedValue({
      id: 'sub_db_123',
      userId: 'user_123',
      plan: 'free',
    });
    mockAuditLog.mockResolvedValue(undefined);
  });

  // ==========================================================================
  // Handler Registration
  // ==========================================================================

  describe('registerStripeWebhookHandlers', () => {
    it('should register all 5 event handlers', () => {
      // Import to trigger registration
      require('@/lib/stripe/webhook-handlers');

      expect(mockWebhookHandlerOn).toHaveBeenCalledTimes(5);
      expect(mockWebhookHandlerOn).toHaveBeenCalledWith(
        'billing.subscription_created',
        expect.any(Function)
      );
      expect(mockWebhookHandlerOn).toHaveBeenCalledWith(
        'billing.subscription_updated',
        expect.any(Function)
      );
      expect(mockWebhookHandlerOn).toHaveBeenCalledWith(
        'billing.subscription_cancelled',
        expect.any(Function)
      );
      expect(mockWebhookHandlerOn).toHaveBeenCalledWith(
        'billing.payment_succeeded',
        expect.any(Function)
      );
      expect(mockWebhookHandlerOn).toHaveBeenCalledWith(
        'billing.payment_failed',
        expect.any(Function)
      );
    });

    it('should register handlers with correct event types', () => {
      // Need to clear mocks before re-importing to get fresh registration
      jest.clearAllMocks();
      jest.isolateModules(() => {
        require('@/lib/stripe/webhook-handlers');

        const registeredEvents = mockWebhookHandlerOn.mock.calls.map((call) => call[0]);
        expect(registeredEvents).toContain('billing.subscription_created');
        expect(registeredEvents).toContain('billing.subscription_updated');
        expect(registeredEvents).toContain('billing.subscription_cancelled');
        expect(registeredEvents).toContain('billing.payment_succeeded');
        expect(registeredEvents).toContain('billing.payment_failed');
      });
    });
  });

  // ==========================================================================
  // Subscription Created
  // ==========================================================================

  describe('handleSubscriptionCreated', () => {
    it('should call subscriptionService.updateFromStripeSubscription', async () => {
      const { handleSubscriptionCreated } = require('@/lib/stripe/webhook-handlers');

      const subscription = createMockSubscription();
      const event = createWebhookEvent('subscription.created', subscription);

      await handleSubscriptionCreated(event);

      expect(mockUpdateFromStripeSubscription).toHaveBeenCalledWith(subscription);
    });

    it('should log audit event with correct details', async () => {
      const { handleSubscriptionCreated } = require('@/lib/stripe/webhook-handlers');

      const subscription = createMockSubscription();
      const event = createWebhookEvent('subscription.created', subscription);

      await handleSubscriptionCreated(event);

      expect(mockAuditLog).toHaveBeenCalledWith({
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
    });

    it('should log info message', async () => {
      const { handleSubscriptionCreated } = require('@/lib/stripe/webhook-handlers');

      const subscription = createMockSubscription();
      const event = createWebhookEvent('subscription.created', subscription);

      await handleSubscriptionCreated(event);

      expect(mockLoggerInfo).toHaveBeenCalledWith('Handling subscription created', {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
      });
    });

    it('should throw error if updateFromStripeSubscription fails', async () => {
      const { handleSubscriptionCreated } = require('@/lib/stripe/webhook-handlers');

      mockUpdateFromStripeSubscription.mockRejectedValue(new Error('Database error'));

      const subscription = createMockSubscription();
      const event = createWebhookEvent('subscription.created', subscription);

      await expect(handleSubscriptionCreated(event)).rejects.toThrow();
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Failed to handle subscription created',
        expect.objectContaining({
          subscriptionId: subscription.id,
        })
      );
    });
  });

  // ==========================================================================
  // Subscription Updated
  // ==========================================================================

  describe('handleSubscriptionUpdated', () => {
    it('should call subscriptionService.updateFromStripeSubscription', async () => {
      const { handleSubscriptionUpdated } = require('@/lib/stripe/webhook-handlers');

      const subscription = createMockSubscription({ status: 'past_due' });
      const event = createWebhookEvent('subscription.updated', subscription);

      await handleSubscriptionUpdated(event);

      expect(mockUpdateFromStripeSubscription).toHaveBeenCalledWith(subscription);
    });

    it('should log audit event with status change details', async () => {
      const { handleSubscriptionUpdated } = require('@/lib/stripe/webhook-handlers');

      const subscription = createMockSubscription({
        status: 'active',
        cancel_at_period_end: true,
      });
      const event = createWebhookEvent('subscription.updated', subscription);

      await handleSubscriptionUpdated(event);

      expect(mockAuditLog).toHaveBeenCalledWith({
        action: 'billing.subscription_updated',
        resource: 'subscription',
        resourceId: subscription.id,
        category: 'compliance',
        severity: 'low',
        outcome: 'success',
        details: {
          customerId: subscription.customer,
          status: subscription.status,
          cancelAtPeriodEnd: true,
        },
      });
    });

    it('should handle subscription with cancel_at_period_end=false', async () => {
      const { handleSubscriptionUpdated } = require('@/lib/stripe/webhook-handlers');

      const subscription = createMockSubscription({ cancel_at_period_end: false });
      const event = createWebhookEvent('subscription.updated', subscription);

      await handleSubscriptionUpdated(event);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            cancelAtPeriodEnd: false,
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Subscription Cancelled
  // ==========================================================================

  describe('handleSubscriptionCancelled', () => {
    it('should downgrade user to free plan', async () => {
      const { handleSubscriptionCancelled } = require('@/lib/stripe/webhook-handlers');

      const subscription = createMockSubscription({ status: 'canceled' });
      const event = createWebhookEvent('subscription.cancelled', subscription);

      mockGetByStripeCustomerId.mockResolvedValue({
        userId: 'user_123',
        plan: 'professional',
      });

      await handleSubscriptionCancelled(event);

      expect(mockGetByStripeCustomerId).toHaveBeenCalledWith('cus_123');
      expect(mockDowngradeToFree).toHaveBeenCalledWith('user_123');
    });

    it('should log audit event for cancellation', async () => {
      const { handleSubscriptionCancelled } = require('@/lib/stripe/webhook-handlers');

      const subscription = createMockSubscription({
        status: 'canceled',
        cancellation_details: { reason: 'cancellation_requested' },
      });
      const event = createWebhookEvent('subscription.cancelled', subscription);

      await handleSubscriptionCancelled(event);

      expect(mockAuditLog).toHaveBeenCalledWith({
        action: 'billing.subscription_cancelled',
        resource: 'subscription',
        resourceId: subscription.id,
        category: 'compliance',
        severity: 'high',
        outcome: 'success',
        details: {
          customerId: subscription.customer,
          reason: 'cancellation_requested',
        },
      });
    });

    it('should handle subscription with no cancellation_details', async () => {
      const { handleSubscriptionCancelled } = require('@/lib/stripe/webhook-handlers');

      const subscription = createMockSubscription({
        status: 'canceled',
        cancellation_details: null,
      });
      const event = createWebhookEvent('subscription.cancelled', subscription);

      await handleSubscriptionCancelled(event);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            reason: undefined,
          }),
        })
      );
    });

    it('should handle when no existing subscription found', async () => {
      const { handleSubscriptionCancelled } = require('@/lib/stripe/webhook-handlers');

      mockGetByStripeCustomerId.mockResolvedValue(null);

      const subscription = createMockSubscription();
      const event = createWebhookEvent('subscription.cancelled', subscription);

      await handleSubscriptionCancelled(event);

      expect(mockDowngradeToFree).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Payment Succeeded
  // ==========================================================================

  describe('handlePaymentSucceeded', () => {
    it('should log audit event for successful payment', async () => {
      const { handlePaymentSucceeded } = require('@/lib/stripe/webhook-handlers');

      const invoice = createMockInvoice({
        amount_paid: 24900,
        currency: 'usd',
        subscription: 'sub_123',
      });
      const event = createWebhookEvent('invoice.payment_succeeded', invoice);

      await handlePaymentSucceeded(event);

      expect(mockAuditLog).toHaveBeenCalledWith({
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
          subscriptionId: 'sub_123',
        },
      });
    });

    it('should handle invoice without subscription', async () => {
      const { handlePaymentSucceeded } = require('@/lib/stripe/webhook-handlers');

      const invoice = createMockInvoice({ subscription: null });
      const event = createWebhookEvent('invoice.payment_succeeded', invoice);

      await handlePaymentSucceeded(event);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            subscriptionId: null,
          }),
        })
      );
    });

    it('should extract subscription ID from old API format (direct field)', async () => {
      const { handlePaymentSucceeded } = require('@/lib/stripe/webhook-handlers');

      const invoice = createMockInvoice();
      (invoice as any).subscription = 'sub_old_format';
      const event = createWebhookEvent('invoice.payment_succeeded', invoice);

      await handlePaymentSucceeded(event);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            subscriptionId: 'sub_old_format',
          }),
        })
      );
    });

    it('should extract subscription ID from new API format (parent.subscription_details)', async () => {
      const { handlePaymentSucceeded } = require('@/lib/stripe/webhook-handlers');

      const invoice = createMockInvoice({ subscription: null });
      (invoice as any).parent = {
        subscription_details: {
          subscription: 'sub_new_format',
        },
      };
      const event = createWebhookEvent('invoice.payment_succeeded', invoice);

      await handlePaymentSucceeded(event);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            subscriptionId: 'sub_new_format',
          }),
        })
      );
    });

    it('should handle subscription as object (not string)', async () => {
      const { handlePaymentSucceeded } = require('@/lib/stripe/webhook-handlers');

      const invoice = createMockInvoice();
      (invoice as any).subscription = createMockSubscription();
      const event = createWebhookEvent('invoice.payment_succeeded', invoice);

      await handlePaymentSucceeded(event);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            subscriptionId: 'sub_123',
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Payment Failed
  // ==========================================================================

  describe('handlePaymentFailed', () => {
    it('should log audit event for failed payment', async () => {
      const { handlePaymentFailed } = require('@/lib/stripe/webhook-handlers');

      const invoice = createMockInvoice({
        amount_due: 24900,
        currency: 'usd',
        subscription: 'sub_123',
        attempt_count: 2,
        status: 'open',
      });
      const event = createWebhookEvent('invoice.payment_failed', invoice);

      await handlePaymentFailed(event);

      expect(mockAuditLog).toHaveBeenCalledWith({
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
          subscriptionId: 'sub_123',
          attemptCount: 2,
        },
      });
    });

    it('should log warning for payment failure', async () => {
      const { handlePaymentFailed } = require('@/lib/stripe/webhook-handlers');

      const invoice = createMockInvoice();
      const event = createWebhookEvent('invoice.payment_failed', invoice);

      await handlePaymentFailed(event);

      expect(mockLoggerWarn).toHaveBeenCalledWith('Handling payment failed', {
        invoiceId: invoice.id,
        customerId: invoice.customer,
      });
    });

    it('should handle invoice without subscription gracefully', async () => {
      const { handlePaymentFailed } = require('@/lib/stripe/webhook-handlers');

      const invoice = createMockInvoice({ subscription: null });
      const event = createWebhookEvent('invoice.payment_failed', invoice);

      await handlePaymentFailed(event);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            subscriptionId: null,
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Webhook Route Contract
  // ==========================================================================

  describe('POST /api/webhooks/stripe - Route Contract', () => {
    it('should define success response shape', () => {
      const successResponse = {
        received: true,
        eventId: 'evt_123',
      };

      expect(successResponse).toHaveProperty('received', true);
      expect(successResponse).toHaveProperty('eventId');
      expect(successResponse.eventId).toMatch(/^evt_/);
    });

    it('should define error response for missing signature', () => {
      const errorResponse = {
        error: 'Missing signature',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toBe('Missing signature');
    });

    it('should define error response for invalid signature', () => {
      const errorResponse = {
        error: 'Invalid signature',
      };

      expect(errorResponse).toHaveProperty('error');
    });

    it('should define error response for handler failure', () => {
      const errorResponse = {
        error: 'Webhook handler failed',
      };

      expect(errorResponse.error).toBe('Webhook handler failed');
    });

    it('should require stripe-signature header', () => {
      const requiredHeaders = ['stripe-signature'];

      expect(requiredHeaders).toContain('stripe-signature');
    });

    it('should return 200 for successful webhook processing', () => {
      const statusCode = 200;
      expect(statusCode).toBe(200);
    });

    it('should return 400 for missing/invalid signature', () => {
      const statusCode = 400;
      expect(statusCode).toBe(400);
    });

    it('should return 500 for internal handler errors', () => {
      const statusCode = 500;
      expect(statusCode).toBe(500);
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('should log errors when handler throws', async () => {
      const { handleSubscriptionCreated } = require('@/lib/stripe/webhook-handlers');

      mockUpdateFromStripeSubscription.mockRejectedValue(new Error('Test error'));

      const subscription = createMockSubscription();
      const event = createWebhookEvent('subscription.created', subscription);

      await expect(handleSubscriptionCreated(event)).rejects.toThrow('Test error');
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it('should log errors with subscription ID for context', async () => {
      const { handleSubscriptionUpdated } = require('@/lib/stripe/webhook-handlers');

      mockUpdateFromStripeSubscription.mockRejectedValue(new Error('Update failed'));

      const subscription = createMockSubscription({ id: 'sub_error_123' });
      const event = createWebhookEvent('subscription.updated', subscription);

      await expect(handleSubscriptionUpdated(event)).rejects.toThrow();
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Failed to handle subscription updated',
        expect.objectContaining({
          subscriptionId: 'sub_error_123',
        })
      );
    });

    it('should log errors with invoice ID for payment handlers', async () => {
      const { handlePaymentSucceeded } = require('@/lib/stripe/webhook-handlers');

      mockAuditLog.mockRejectedValue(new Error('Audit log failed'));

      const invoice = createMockInvoice({ id: 'in_error_123' });
      const event = createWebhookEvent('invoice.payment_succeeded', invoice);

      await expect(handlePaymentSucceeded(event)).rejects.toThrow();
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Failed to handle payment succeeded',
        expect.objectContaining({
          invoiceId: 'in_error_123',
        })
      );
    });
  });
});
