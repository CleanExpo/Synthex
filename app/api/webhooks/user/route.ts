/**
 * User Webhook Subscription API
 *
 * Manages outgoing webhook subscriptions for users.
 * CRUD operations for webhook endpoints with Prisma persistence.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/webhooks/user/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { z } from 'zod';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { getUserIdFromCookies } from '@/lib/auth/jwt-utils';
import { sendTestWebhook, broadcastWebhook, type WebhookEventType } from '@/lib/webhooks/sender';
import { logger } from '@/lib/logger';

// =============================================================================
// Constants - All available webhook event types
// =============================================================================

const AVAILABLE_EVENTS: WebhookEventType[] = [
  // User events
  'user.created',
  'user.updated',
  'user.deleted',
  'user.login',
  'user.logout',
  // Content events
  'content.created',
  'content.updated',
  'content.published',
  'content.scheduled',
  'content.failed',
  'content.deleted',
  // Campaign events
  'campaign.created',
  'campaign.started',
  'campaign.completed',
  'campaign.paused',
  'campaign.deleted',
  // Team events
  'team.member.added',
  'team.member.removed',
  'team.role.changed',
  'team.settings.updated',
  // Subscription events
  'subscription.created',
  'subscription.updated',
  'subscription.cancelled',
  'subscription.payment.succeeded',
  'subscription.payment.failed',
  // Integration events
  'integration.connected',
  'integration.disconnected',
  'integration.error',
  // Analytics events
  'analytics.report.ready',
  'analytics.alert.triggered',
  // System events
  'webhook.test',
  'webhook.ping',
];

// =============================================================================
// Schemas
// =============================================================================

const webhookSubscriptionSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  events: z.array(z.enum([
    'user.created',
    'user.updated',
    'user.deleted',
    'user.login',
    'user.logout',
    'content.created',
    'content.updated',
    'content.published',
    'content.scheduled',
    'content.failed',
    'content.deleted',
    'campaign.created',
    'campaign.started',
    'campaign.completed',
    'campaign.paused',
    'campaign.deleted',
    'team.member.added',
    'team.member.removed',
    'team.role.changed',
    'team.settings.updated',
    'subscription.created',
    'subscription.updated',
    'subscription.cancelled',
    'subscription.payment.succeeded',
    'subscription.payment.failed',
    'integration.connected',
    'integration.disconnected',
    'integration.error',
    'analytics.report.ready',
    'analytics.alert.triggered',
    'webhook.test',
    'webhook.ping',
  ])).min(1, 'At least one event type required'),
  secret: z.string().min(16, 'Secret must be at least 16 characters').optional(),
  active: z.boolean().optional().default(true),
  description: z.string().max(500).optional(),
});

const webhookUpdateSchema = z.object({
  id: z.string().min(1, 'Webhook ID required'),
  url: z.string().url('Invalid webhook URL').optional(),
  events: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  description: z.string().max(500).optional().nullable(),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get secret preview (last 4 characters)
 */
function getSecretPreview(secret: string): string {
  return secret.slice(-4);
}

/**
 * Transform webhook endpoint for API response (strips full secret)
 */
function transformWebhookForResponse(webhook: {
  id: string;
  url: string;
  secret: string;
  description: string | null;
  events: unknown;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastDeliveredAt: Date | null;
  failureCount: number;
  metadata: unknown;
}) {
  return {
    id: webhook.id,
    url: webhook.url,
    secretPreview: getSecretPreview(webhook.secret),
    description: webhook.description,
    events: webhook.events as string[],
    active: webhook.active,
    createdAt: webhook.createdAt.toISOString(),
    updatedAt: webhook.updatedAt.toISOString(),
    lastDeliveredAt: webhook.lastDeliveredAt?.toISOString() || null,
    failureCount: webhook.failureCount,
  };
}

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * GET /api/webhooks/user - List user's webhook subscriptions
 */
export async function GET() {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const webhooks = await prisma.webhookEndpoint.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: webhooks.map(transformWebhookForResponse),
      availableEvents: AVAILABLE_EVENTS,
    });
  } catch (error: unknown) {
    logger.error('List webhooks error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to list webhooks') },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks/user - Create webhook subscription
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = webhookSubscriptionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { url, events, secret, active, description } = validation.data;

    // Generate a secret if not provided
    const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

    // Test the webhook URL first
    const testResult = await sendTestWebhook(url, webhookSecret);

    // Determine if we should create as active or inactive based on test result
    const shouldBeActive = testResult.success ? active : false;
    const warning = !testResult.success
      ? `Test webhook failed (${testResult.error}). Endpoint created as inactive.`
      : undefined;

    // Create the webhook endpoint and audit log in a transaction
    const webhook = await prisma.$transaction(async (tx) => {
      const created = await tx.webhookEndpoint.create({
        data: {
          url,
          secret: webhookSecret,
          description: description || null,
          events: events,
          active: shouldBeActive,
          userId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'webhook_created',
          resource: 'webhook',
          resourceId: created.id,
          userId,
          details: { url, events, active: shouldBeActive, testResult: testResult.success },
          severity: 'low',
          category: 'system',
          outcome: 'success',
        },
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      message: warning ? 'Webhook subscription created with warning' : 'Webhook subscription created',
      warning,
      data: {
        id: webhook.id,
        url: webhook.url,
        secret: webhookSecret, // Return full secret only on creation
        secretPreview: getSecretPreview(webhookSecret),
        description: webhook.description,
        events: webhook.events,
        active: webhook.active,
        createdAt: webhook.createdAt.toISOString(),
        updatedAt: webhook.updatedAt.toISOString(),
        lastDeliveredAt: null,
        failureCount: 0,
      },
    });
  } catch (error: unknown) {
    logger.error('Create webhook error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to create webhook') },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/webhooks/user - Update webhook subscription
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = webhookUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { id, url, events, active, description } = validation.data;

    // Verify ownership
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Webhook not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: {
      url?: string;
      events?: string[];
      active?: boolean;
      description?: string | null;
    } = {};

    if (url !== undefined) updateData.url = url;
    if (events !== undefined) updateData.events = events;
    if (active !== undefined) updateData.active = active;
    if (description !== undefined) updateData.description = description;

    // If URL changed, test the new endpoint
    let warning: string | undefined;
    if (url && url !== existing.url) {
      const testResult = await sendTestWebhook(url, existing.secret);
      if (!testResult.success) {
        warning = `Test webhook to new URL failed (${testResult.error}). Update applied anyway.`;
      }
    }

    // Update the webhook and log in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.webhookEndpoint.update({
        where: { id },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          action: 'webhook_updated',
          resource: 'webhook',
          resourceId: id,
          userId,
          details: { changes: Object.keys(updateData) },
          severity: 'low',
          category: 'system',
          outcome: 'success',
        },
      });

      return result;
    });

    return NextResponse.json({
      success: true,
      message: warning ? 'Webhook updated with warning' : 'Webhook updated',
      warning,
      data: transformWebhookForResponse(updated),
    });
  } catch (error: unknown) {
    logger.error('Update webhook error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to update webhook') },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/webhooks/user - Delete webhook subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get('id');

    if (!webhookId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Webhook ID required' },
        { status: 400 }
      );
    }

    // Delete with ownership check and log in a transaction
    const deleted = await prisma.$transaction(async (tx) => {
      const result = await tx.webhookEndpoint.deleteMany({
        where: { id: webhookId, userId },
      });

      if (result.count === 0) {
        return result;
      }

      await tx.auditLog.create({
        data: {
          action: 'webhook_deleted',
          resource: 'webhook',
          resourceId: webhookId,
          userId,
          details: {},
          severity: 'low',
          category: 'system',
          outcome: 'success',
        },
      });

      return result;
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Webhook not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook subscription deleted',
    });
  } catch (error: unknown) {
    logger.error('Delete webhook error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to delete webhook') },
      { status: 500 }
    );
  }
}

// =============================================================================
// Webhook Trigger Functions (for use by other services)
// =============================================================================

/**
 * Trigger webhooks for an event - queries subscriptions and broadcasts
 */
async function triggerWebhooks(
  userId: string,
  event: WebhookEventType,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    // Get all active subscriptions for this user that include this event
    const subscriptions = await prisma.webhookEndpoint.findMany({
      where: {
        userId,
        active: true,
      },
    });

    // Filter to those subscribed to this event
    const relevantSubs = subscriptions.filter((sub) => {
      const events = sub.events as string[];
      return events.includes(event);
    });

    if (relevantSubs.length === 0) {
      return;
    }

    // Convert to format expected by broadcastWebhook
    const webhookSubscriptions = relevantSubs.map((sub) => ({
      id: sub.id,
      url: sub.url,
      events: sub.events as WebhookEventType[],
      secret: sub.secret,
      active: sub.active,
    }));

    // Broadcast to all subscribers
    const result = await broadcastWebhook(event, payload, webhookSubscriptions);

    // Update delivery timestamps and failure counts
    for (const deliveryResult of result.results) {
      const sub = relevantSubs.find((s) =>
        webhookSubscriptions.find((ws) => ws.id === s.id && ws.url === s.url)
      );
      if (sub) {
        if (deliveryResult.success) {
          await prisma.webhookEndpoint.update({
            where: { id: sub.id },
            data: {
              lastDeliveredAt: new Date(),
              failureCount: 0, // Reset on success
            },
          });
        } else {
          await prisma.webhookEndpoint.update({
            where: { id: sub.id },
            data: {
              failureCount: { increment: 1 },
            },
          });
        }
      }
    }
  } catch (error) {
    logger.error('triggerWebhooks error:', error);
    // Don't throw - webhook failures shouldn't break the main operation
  }
}

async function deliverWebhook(
  webhookId: string,
  url: string,
  event: string,
  payload: Record<string, unknown>,
  secret?: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': event,
    'X-Webhook-Timestamp': Date.now().toString(),
  };

  if (secret) {
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
    headers['X-Webhook-Signature'] = `sha256=${signature}`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10000),
    });

    // Log delivery
    await prisma.auditLog.create({
      data: {
        action: response.ok ? 'webhook_delivered' : 'webhook_failed',
        resource: 'webhook',
        resourceId: webhookId,
        details: { event, url, statusCode: response.status },
        severity: response.ok ? 'low' : 'medium',
        category: 'system',
        outcome: response.ok ? 'success' : 'failure',
      },
    });

    return {
      success: response.ok,
      statusCode: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await prisma.auditLog.create({
      data: {
        action: 'webhook_failed',
        resource: 'webhook',
        resourceId: webhookId,
        details: { event, url, error: errorMessage },
        severity: 'medium',
        category: 'system',
        outcome: 'failure',
      },
    });

    return { success: false, error: errorMessage };
  }
}

export const runtime = 'nodejs';
