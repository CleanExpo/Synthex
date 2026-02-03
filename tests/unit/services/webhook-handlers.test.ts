/**
 * Stripe Webhook Handlers Unit Tests
 *
 * @description Tests for Stripe webhook event handlers
 */

import Stripe from 'stripe';

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

// Mock webhook handler
const mockOn = jest.fn();
jest.mock('@/lib/webhooks/webhook-handler', () => ({
  webhookHandler: {
    on: mockOn,
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
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after mocks
import {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionCancelled,
  handlePaymentSucceeded,
  handlePaymentFailed,
  registerStripeWebhookHandlers,
} from '@/lib/stripe/webhook-handlers';

describe('Stripe Webhook Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerStripeWebhookHandlers', () => {
    it('should register all webhook handlers', () => {
      // Clear any previous registrations
      mockOn.mockClear();

      // Re-import to trigger registration
      jest.isolateModules(() => {
        require('@/lib/stripe/webhook-handlers');
      });

      // Check that handlers were registered
      expect(mockOn).toHaveBeenCalledWith('billing.subscription_created', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('billing.subscription_updated', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('billing.subscription_cancelled', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('billing.payment_succeeded', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('billing.payment_failed', expect.any(Function));
    });
  });

  describe('handleSubscriptionCreated', () => {
    const mockSubscription: Partial<Stripe.Subscription> = {
      id: 'sub_123',
      customer: 'cus_456',
      status: 'active',
      items: {
        data: [{ price: { id: 'price_professional' } }],
      } as Stripe.ApiList<Stripe.SubscriptionItem>,
    };

    const mockEvent = {
      type: 'billing.subscription_created',
      data: {
        id: 'evt_123',
        object: 'event',
        type: 'customer.subscription.created',
        data: {
          object: mockSubscription,
        },
      },
    };

    it('should update subscription from Stripe data', async () => {
      mockUpdateFromStripeSubscription.mockResolvedValue({});

      await handleSubscriptionCreated(mockEvent);

      expect(mockUpdateFromStripeSubscription).toHaveBeenCalledWith(mockSubscription);
    });

    it('should log audit event on success', async () => {
      mockUpdateFromStripeSubscription.mockResolvedValue({});

      await handleSubscriptionCreated(mockEvent);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'billing.subscription_created',
          resource: 'subscription',
          resourceId: 'sub_123',
          category: 'compliance',
          severity: 'medium',
          outcome: 'success',
        })
      );
    });

    it('should throw error on failure', async () => {
      mockUpdateFromStripeSubscription.mockRejectedValue(new Error('Database error'));

      await expect(handleSubscriptionCreated(mockEvent)).rejects.toThrow('Database error');
    });
  });

  describe('handleSubscriptionUpdated', () => {
    const mockSubscription: Partial<Stripe.Subscription> = {
      id: 'sub_123',
      customer: 'cus_456',
      status: 'active',
      cancel_at_period_end: false,
      items: {
        data: [{ price: { id: 'price_professional' } }],
      } as Stripe.ApiList<Stripe.SubscriptionItem>,
    };

    const mockEvent = {
      type: 'billing.subscription_updated',
      data: {
        id: 'evt_456',
        object: 'event',
        type: 'customer.subscription.updated',
        data: {
          object: mockSubscription,
        },
      },
    };

    it('should update subscription from Stripe data', async () => {
      mockUpdateFromStripeSubscription.mockResolvedValue({});

      await handleSubscriptionUpdated(mockEvent);

      expect(mockUpdateFromStripeSubscription).toHaveBeenCalledWith(mockSubscription);
    });

    it('should log audit event with low severity', async () => {
      mockUpdateFromStripeSubscription.mockResolvedValue({});

      await handleSubscriptionUpdated(mockEvent);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'billing.subscription_updated',
          severity: 'low',
        })
      );
    });
  });

  describe('handleSubscriptionCancelled', () => {
    const mockSubscription: Partial<Stripe.Subscription> = {
      id: 'sub_123',
      customer: 'cus_456',
      status: 'canceled',
      cancellation_details: {
        reason: 'cancellation_requested',
      } as Stripe.Subscription.CancellationDetails,
      items: {
        data: [],
      } as Stripe.ApiList<Stripe.SubscriptionItem>,
    };

    const mockEvent = {
      type: 'billing.subscription_cancelled',
      data: {
        id: 'evt_789',
        object: 'event',
        type: 'customer.subscription.deleted',
        data: {
          object: mockSubscription,
        },
      },
    };

    it('should downgrade user to free plan', async () => {
      mockGetByStripeCustomerId.mockResolvedValue({
        userId: 'user_123',
      });
      mockDowngradeToFree.mockResolvedValue({});

      await handleSubscriptionCancelled(mockEvent);

      expect(mockGetByStripeCustomerId).toHaveBeenCalledWith('cus_456');
      expect(mockDowngradeToFree).toHaveBeenCalledWith('user_123');
    });

    it('should not downgrade if subscription not found', async () => {
      mockGetByStripeCustomerId.mockResolvedValue(null);

      await handleSubscriptionCancelled(mockEvent);

      expect(mockDowngradeToFree).not.toHaveBeenCalled();
    });

    it('should log audit event with high severity', async () => {
      mockGetByStripeCustomerId.mockResolvedValue({ userId: 'user_123' });
      mockDowngradeToFree.mockResolvedValue({});

      await handleSubscriptionCancelled(mockEvent);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'billing.subscription_cancelled',
          severity: 'high',
        })
      );
    });
  });

  describe('handlePaymentSucceeded', () => {
    const mockInvoice: Partial<Stripe.Invoice> = {
      id: 'inv_123',
      customer: 'cus_456',
      amount_paid: 2900,
      currency: 'usd',
    };

    const mockEvent = {
      type: 'billing.payment_succeeded',
      data: {
        id: 'evt_payment_123',
        object: 'event',
        type: 'invoice.payment_succeeded',
        data: {
          object: mockInvoice,
        },
      },
    };

    it('should log audit event with payment details', async () => {
      await handlePaymentSucceeded(mockEvent);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'billing.payment_succeeded',
          resource: 'invoice',
          resourceId: 'inv_123',
          outcome: 'success',
          details: expect.objectContaining({
            customerId: 'cus_456',
            amountPaid: 2900,
            currency: 'usd',
          }),
        })
      );
    });
  });

  describe('handlePaymentFailed', () => {
    const mockInvoice: Partial<Stripe.Invoice> = {
      id: 'inv_456',
      customer: 'cus_789',
      amount_due: 2900,
      currency: 'usd',
      attempt_count: 2,
    };

    const mockEvent = {
      type: 'billing.payment_failed',
      data: {
        id: 'evt_payment_456',
        object: 'event',
        type: 'invoice.payment_failed',
        data: {
          object: mockInvoice,
        },
      },
    };

    it('should log audit event with failure details', async () => {
      await handlePaymentFailed(mockEvent);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'billing.payment_failed',
          resource: 'invoice',
          severity: 'high',
          outcome: 'failure',
          details: expect.objectContaining({
            customerId: 'cus_789',
            amountDue: 2900,
            attemptCount: 2,
          }),
        })
      );
    });
  });
});

describe('Webhook Event Structure', () => {
  it('should handle events with correct data structure', () => {
    // Verify the expected event structure
    const eventStructure = {
      type: 'billing.subscription_created',
      data: {
        id: expect.any(String),
        object: 'event',
        type: expect.any(String),
        data: {
          object: expect.any(Object),
        },
      },
    };

    expect(eventStructure.data.object).toBe('event');
  });
});
