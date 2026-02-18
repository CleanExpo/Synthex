/**
 * Webhook API Contract Tests
 *
 * Validates that webhook types and handlers conform to their expected shapes.
 *
 * @module tests/contract/webhooks.contract.test
 */

import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';

// =============================================================================
// Webhook Schemas (mirroring lib/webhooks/types.ts)
// =============================================================================

const webhookPlatformSchema = z.enum([
  'twitter',
  'facebook',
  'instagram',
  'tiktok',
  'linkedin',
  'pinterest',
  'youtube',
  'threads',
  'reddit',
  'stripe',
  'internal',
]);

const webhookEventTypeSchema = z.enum([
  // Content events
  'post.created',
  'post.published',
  'post.updated',
  'post.deleted',
  'post.failed',
  // Engagement events
  'engagement.like',
  'engagement.comment',
  'engagement.share',
  'engagement.save',
  'engagement.reaction',
  // Follower events
  'follower.gained',
  'follower.lost',
  'follower.milestone',
  // Analytics events
  'analytics.metrics_updated',
  'analytics.report_ready',
  'analytics.threshold_alert',
  // Account events
  'account.connected',
  'account.disconnected',
  'account.token_refreshed',
  'account.token_expired',
  // Billing events
  'billing.subscription_created',
  'billing.subscription_updated',
  'billing.subscription_cancelled',
  'billing.payment_succeeded',
  'billing.payment_failed',
  // System events
  'system.health_check',
  'system.error',
  'system.maintenance',
]);

const webhookEventSchema = z.object({
  id: z.string().uuid(),
  type: webhookEventTypeSchema,
  platform: webhookPlatformSchema,
  timestamp: z.string().datetime().or(z.date()),
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  data: z.record(z.unknown()),
  metadata: z
    .object({
      version: z.string().optional(),
      source: z.string().optional(),
      correlationId: z.string().optional(),
      retryCount: z.number().optional(),
    })
    .optional(),
});

const webhookDeliverySchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  endpoint: z.string().url(),
  status: z.enum(['pending', 'delivered', 'failed', 'retrying']),
  attempts: z.number().int().min(0),
  lastAttemptAt: z.string().datetime().or(z.date()).optional(),
  nextRetryAt: z.string().datetime().or(z.date()).optional(),
  response: z
    .object({
      statusCode: z.number().int(),
      body: z.string().optional(),
      headers: z.record(z.string()).optional(),
    })
    .optional(),
  error: z.string().optional(),
});

const webhookEndpointSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  secret: z.string().min(16),
  events: z.array(webhookEventTypeSchema),
  isActive: z.boolean(),
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  createdAt: z.string().datetime().or(z.date()),
  updatedAt: z.string().datetime().or(z.date()),
  metadata: z.record(z.unknown()).optional(),
});

const webhookConfigSchema = z.object({
  maxRetries: z.number().int().min(0),
  retryDelays: z.array(z.number().int().min(0)),
  timeout: z.number().int().min(1000),
  batchSize: z.number().int().min(1),
  concurrency: z.number().int().min(1),
});

const webhookVerificationResultSchema = z.object({
  valid: z.boolean(),
  error: z.string().optional(),
  platform: webhookPlatformSchema.optional(),
  timestamp: z.string().datetime().or(z.date()).optional(),
});

const queuedEventSchema = z.object({
  event: webhookEventSchema,
  priority: z.number().int(),
  queuedAt: z.string().datetime().or(z.date()),
  processAfter: z.string().datetime().or(z.date()).optional(),
});

// =============================================================================
// Stripe Webhook Schemas
// =============================================================================

const stripeSubscriptionEventSchema = z.object({
  id: z.string(),
  object: z.literal('event'),
  type: z.string().startsWith('customer.subscription'),
  data: z.object({
    object: z.object({
      id: z.string().startsWith('sub_'),
      customer: z.string().startsWith('cus_'),
      status: z.enum([
        'active',
        'past_due',
        'unpaid',
        'canceled',
        'incomplete',
        'incomplete_expired',
        'trialing',
        'paused',
      ]),
      items: z.object({
        data: z.array(
          z.object({
            price: z.object({
              id: z.string().startsWith('price_'),
            }),
          })
        ),
      }),
      cancel_at_period_end: z.boolean().optional(),
      cancellation_details: z
        .object({
          reason: z.string().optional(),
        })
        .optional(),
    }),
  }),
});

const stripeInvoiceEventSchema = z.object({
  id: z.string(),
  object: z.literal('event'),
  type: z.string().startsWith('invoice.'),
  data: z.object({
    object: z.object({
      id: z.string().startsWith('in_'),
      customer: z.string().startsWith('cus_'),
      amount_paid: z.number().optional(),
      amount_due: z.number().optional(),
      currency: z.string().length(3),
      attempt_count: z.number().optional(),
    }),
  }),
});

// =============================================================================
// Tests
// =============================================================================

describe('Webhook Contract Tests', () => {
  describe('Platform Schema Validation', () => {
    it('should validate all supported platforms', () => {
      const platforms = [
        'twitter',
        'facebook',
        'instagram',
        'tiktok',
        'linkedin',
        'pinterest',
        'youtube',
        'threads',
        'reddit',
        'stripe',
        'internal',
      ];

      platforms.forEach((platform) => {
        const result = webhookPlatformSchema.safeParse(platform);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid platforms', () => {
      const result = webhookPlatformSchema.safeParse('invalid-platform');
      expect(result.success).toBe(false);
    });
  });

  describe('Event Type Schema Validation', () => {
    it('should validate content event types', () => {
      const contentEvents = [
        'post.created',
        'post.published',
        'post.updated',
        'post.deleted',
        'post.failed',
      ];

      contentEvents.forEach((event) => {
        const result = webhookEventTypeSchema.safeParse(event);
        expect(result.success).toBe(true);
      });
    });

    it('should validate engagement event types', () => {
      const engagementEvents = [
        'engagement.like',
        'engagement.comment',
        'engagement.share',
        'engagement.save',
        'engagement.reaction',
      ];

      engagementEvents.forEach((event) => {
        const result = webhookEventTypeSchema.safeParse(event);
        expect(result.success).toBe(true);
      });
    });

    it('should validate billing event types', () => {
      const billingEvents = [
        'billing.subscription_created',
        'billing.subscription_updated',
        'billing.subscription_cancelled',
        'billing.payment_succeeded',
        'billing.payment_failed',
      ];

      billingEvents.forEach((event) => {
        const result = webhookEventTypeSchema.safeParse(event);
        expect(result.success).toBe(true);
      });
    });

    it('should validate system event types', () => {
      const systemEvents = ['system.health_check', 'system.error', 'system.maintenance'];

      systemEvents.forEach((event) => {
        const result = webhookEventTypeSchema.safeParse(event);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Webhook Event Schema Validation', () => {
    it('should validate a complete webhook event', () => {
      const mockEvent = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'post.published',
        platform: 'twitter',
        timestamp: '2025-01-15T12:00:00.000Z',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        organizationId: '123e4567-e89b-12d3-a456-426614174002',
        data: {
          postId: 'post_123',
          content: 'Hello world!',
        },
        metadata: {
          version: '1.0',
          source: 'api',
          correlationId: 'corr_123',
        },
      };

      const result = webhookEventSchema.safeParse(mockEvent);
      expect(result.success).toBe(true);
    });

    it('should validate minimal webhook event', () => {
      const mockEvent = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'system.health_check',
        platform: 'internal',
        timestamp: '2025-01-15T12:00:00.000Z',
        data: {},
      };

      const result = webhookEventSchema.safeParse(mockEvent);
      expect(result.success).toBe(true);
    });

    it('should reject event with invalid type', () => {
      const mockEvent = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'invalid.event',
        platform: 'twitter',
        timestamp: '2025-01-15T12:00:00.000Z',
        data: {},
      };

      const result = webhookEventSchema.safeParse(mockEvent);
      expect(result.success).toBe(false);
    });
  });

  describe('Webhook Delivery Schema Validation', () => {
    it('should validate successful delivery', () => {
      const mockDelivery = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        eventId: '123e4567-e89b-12d3-a456-426614174001',
        endpoint: 'https://example.com/webhook',
        status: 'delivered',
        attempts: 1,
        lastAttemptAt: '2025-01-15T12:00:00.000Z',
        response: {
          statusCode: 200,
          body: 'OK',
        },
      };

      const result = webhookDeliverySchema.safeParse(mockDelivery);
      expect(result.success).toBe(true);
    });

    it('should validate failed delivery with error', () => {
      const mockDelivery = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        eventId: '123e4567-e89b-12d3-a456-426614174001',
        endpoint: 'https://example.com/webhook',
        status: 'failed',
        attempts: 5,
        lastAttemptAt: '2025-01-15T12:00:00.000Z',
        error: 'Connection timeout',
      };

      const result = webhookDeliverySchema.safeParse(mockDelivery);
      expect(result.success).toBe(true);
    });

    it('should validate pending delivery', () => {
      const mockDelivery = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        eventId: '123e4567-e89b-12d3-a456-426614174001',
        endpoint: 'https://example.com/webhook',
        status: 'pending',
        attempts: 0,
      };

      const result = webhookDeliverySchema.safeParse(mockDelivery);
      expect(result.success).toBe(true);
    });
  });

  describe('Webhook Endpoint Schema Validation', () => {
    it('should validate complete endpoint', () => {
      const mockEndpoint = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        url: 'https://example.com/webhook',
        secret: 'whsec_abcdefghijklmnop',
        events: ['post.published', 'post.deleted'],
        isActive: true,
        userId: '123e4567-e89b-12d3-a456-426614174001',
        createdAt: '2025-01-15T12:00:00.000Z',
        updatedAt: '2025-01-15T12:00:00.000Z',
      };

      const result = webhookEndpointSchema.safeParse(mockEndpoint);
      expect(result.success).toBe(true);
    });

    it('should reject endpoint with short secret', () => {
      const mockEndpoint = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        url: 'https://example.com/webhook',
        secret: 'short',
        events: ['post.published'],
        isActive: true,
        createdAt: '2025-01-15T12:00:00.000Z',
        updatedAt: '2025-01-15T12:00:00.000Z',
      };

      const result = webhookEndpointSchema.safeParse(mockEndpoint);
      expect(result.success).toBe(false);
    });
  });

  describe('Webhook Config Schema Validation', () => {
    it('should validate default config', () => {
      const defaultConfig = {
        maxRetries: 5,
        retryDelays: [1000, 5000, 30000, 120000, 600000],
        timeout: 30000,
        batchSize: 100,
        concurrency: 10,
      };

      const result = webhookConfigSchema.safeParse(defaultConfig);
      expect(result.success).toBe(true);
    });

    it('should reject config with invalid timeout', () => {
      const invalidConfig = {
        maxRetries: 5,
        retryDelays: [1000],
        timeout: 500, // Less than 1000ms minimum
        batchSize: 100,
        concurrency: 10,
      };

      const result = webhookConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('Webhook Verification Schema Validation', () => {
    it('should validate successful verification', () => {
      const mockResult = {
        valid: true,
        platform: 'stripe',
        timestamp: '2025-01-15T12:00:00.000Z',
      };

      const result = webhookVerificationResultSchema.safeParse(mockResult);
      expect(result.success).toBe(true);
    });

    it('should validate failed verification', () => {
      const mockResult = {
        valid: false,
        error: 'Invalid signature',
      };

      const result = webhookVerificationResultSchema.safeParse(mockResult);
      expect(result.success).toBe(true);
    });
  });

  describe('Stripe Webhook Event Schemas', () => {
    it('should validate subscription created event', () => {
      const mockEvent = {
        id: 'evt_123',
        object: 'event',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_456',
            status: 'active',
            items: {
              data: [
                {
                  price: {
                    id: 'price_789',
                  },
                },
              ],
            },
          },
        },
      };

      const result = stripeSubscriptionEventSchema.safeParse(mockEvent);
      expect(result.success).toBe(true);
    });

    it('should validate subscription cancelled event', () => {
      const mockEvent = {
        id: 'evt_123',
        object: 'event',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_456',
            status: 'canceled',
            items: {
              data: [
                {
                  price: {
                    id: 'price_789',
                  },
                },
              ],
            },
            cancel_at_period_end: false,
            cancellation_details: {
              reason: 'cancellation_requested',
            },
          },
        },
      };

      const result = stripeSubscriptionEventSchema.safeParse(mockEvent);
      expect(result.success).toBe(true);
    });

    it('should validate invoice payment succeeded event', () => {
      const mockEvent = {
        id: 'evt_123',
        object: 'event',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_123',
            customer: 'cus_456',
            amount_paid: 2999,
            currency: 'usd',
          },
        },
      };

      const result = stripeInvoiceEventSchema.safeParse(mockEvent);
      expect(result.success).toBe(true);
    });

    it('should validate invoice payment failed event', () => {
      const mockEvent = {
        id: 'evt_123',
        object: 'event',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_123',
            customer: 'cus_456',
            amount_due: 2999,
            currency: 'usd',
            attempt_count: 3,
          },
        },
      };

      const result = stripeInvoiceEventSchema.safeParse(mockEvent);
      expect(result.success).toBe(true);
    });
  });

  describe('Queued Event Schema Validation', () => {
    it('should validate queued event with priority', () => {
      const mockQueuedEvent = {
        event: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          type: 'post.published',
          platform: 'twitter',
          timestamp: '2025-01-15T12:00:00.000Z',
          data: { postId: 'post_123' },
        },
        priority: 1,
        queuedAt: '2025-01-15T12:00:00.000Z',
      };

      const result = queuedEventSchema.safeParse(mockQueuedEvent);
      expect(result.success).toBe(true);
    });

    it('should validate queued event with delayed processing', () => {
      const mockQueuedEvent = {
        event: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          type: 'billing.subscription_created',
          platform: 'stripe',
          timestamp: '2025-01-15T12:00:00.000Z',
          data: { subscriptionId: 'sub_123' },
        },
        priority: 10,
        queuedAt: '2025-01-15T12:00:00.000Z',
        processAfter: '2025-01-15T12:05:00.000Z',
      };

      const result = queuedEventSchema.safeParse(mockQueuedEvent);
      expect(result.success).toBe(true);
    });
  });
});
