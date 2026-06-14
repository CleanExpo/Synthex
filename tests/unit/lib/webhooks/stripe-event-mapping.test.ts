/**
 * Unit tests for WebhookHandler Stripe invoice event-type mapping.
 *
 * Regression coverage for the billing gap where `parseStripeEventType` used
 * fragile substring checks (`type.includes('paid')` / `.includes('failed')`).
 * Stripe's real success event `invoice.payment_succeeded` does NOT contain the
 * substring "paid" (it's "succeeded"), so it was silently dropped (unmapped →
 * no-op, then de-duplicated by idempotency). These tests assert the exact-name
 * mapping routes every relevant invoice event to the correct internal handler
 * type, and that previously-working mappings still pass.
 */

import { WebhookHandler } from '@/lib/webhooks/webhook-handler';
import type { WebhookEventType } from '@/lib/webhooks/types';

// Mock external collaborators that the module pulls in at import time so the
// handler can be instantiated in isolation without touching Redis / Prisma.
jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/redis-client', () => ({
  getRedisClient: () => ({ isConnected: false }),
}));

/**
 * `parseEventType` is private; cast to reach it. This is the seam under test —
 * it's exactly what `receive()` / `receiveAndProcess()` call to decide whether
 * a Stripe event maps to a real handler or is dropped as "unknown".
 */
function parseStripe(type: string): WebhookEventType | null {
  const handler = new WebhookHandler();
  return (
    handler as unknown as {
      parseEventType: (
        platform: 'stripe',
        data: Record<string, unknown>
      ) => WebhookEventType | null;
    }
  ).parseEventType('stripe', { type, data: { object: {} } });
}

describe('WebhookHandler — Stripe invoice event mapping', () => {
  describe('the previously-dropped success event', () => {
    it('maps invoice.payment_succeeded → billing.payment_succeeded (was silently dropped)', () => {
      // This is the core bug: "succeeded" does not contain "paid".
      expect(parseStripe('invoice.payment_succeeded')).toBe(
        'billing.payment_succeeded'
      );
    });

    it('does NOT treat invoice.payment_succeeded as unknown/no-op', () => {
      expect(parseStripe('invoice.payment_succeeded')).not.toBeNull();
    });
  });

  describe('failure + other invoice events', () => {
    it('maps invoice.payment_failed → billing.payment_failed', () => {
      expect(parseStripe('invoice.payment_failed')).toBe(
        'billing.payment_failed'
      );
    });

    it('still maps invoice.paid → billing.payment_succeeded (pre-existing mapping must not break)', () => {
      expect(parseStripe('invoice.paid')).toBe('billing.payment_succeeded');
    });
  });

  describe('exact-name matching — no false positives from substrings', () => {
    it('does not map an unrelated invoice event that merely contains a keyword-like substring', () => {
      // `invoice.upcoming` / `invoice.finalized` are events we deliberately do
      // not act on; they must remain unmapped rather than being swept in.
      expect(parseStripe('invoice.upcoming')).toBeNull();
      expect(parseStripe('invoice.finalized')).toBeNull();
    });
  });

  describe('non-invoice billing mappings still pass', () => {
    it('maps customer.subscription.created → billing.subscription_created', () => {
      expect(parseStripe('customer.subscription.created')).toBe(
        'billing.subscription_created'
      );
    });

    it('maps customer.subscription.updated → billing.subscription_updated', () => {
      expect(parseStripe('customer.subscription.updated')).toBe(
        'billing.subscription_updated'
      );
    });

    it('maps customer.subscription.deleted → billing.subscription_cancelled', () => {
      expect(parseStripe('customer.subscription.deleted')).toBe(
        'billing.subscription_cancelled'
      );
    });

    it('maps checkout.session.completed → billing.checkout_completed', () => {
      expect(parseStripe('checkout.session.completed')).toBe(
        'billing.checkout_completed'
      );
    });

    it('returns null for a genuinely unhandled Stripe event', () => {
      expect(parseStripe('charge.refunded')).toBeNull();
    });
  });
});
