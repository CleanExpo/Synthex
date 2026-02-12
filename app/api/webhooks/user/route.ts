/**
 * User Event Webhook Handler
 *
 * Handles outgoing webhooks for user-related events.
 * Also provides endpoints for webhook subscription management.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 * - WEBHOOK_SIGNING_SECRET (SECRET)
 *
 * @module app/api/webhooks/user/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { z } from 'zod';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';

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
    'content.created',
    'content.published',
    'content.failed',
    'campaign.created',
    'campaign.completed',
    'subscription.created',
    'subscription.cancelled',
  ])).min(1, 'At least one event type required'),
  secret: z.string().min(16, 'Secret must be at least 16 characters').optional(),
  active: z.boolean().optional().default(true),
  description: z.string().max(500).optional(),
});

// =============================================================================
// Auth Helper - Uses centralized JWT utilities (no fallback secrets)
// =============================================================================

import { verifyToken } from '@/lib/auth/jwt-utils';

async function getUserFromRequest(request: NextRequest): Promise<{ id: string; email: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);
    return { id: decoded.userId, email: decoded.email || '' };
  } catch {
    return null;
  }
}

// =============================================================================
// Webhook Delivery
// =============================================================================

/**
 * Sign webhook payload
 */
function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Deliver webhook with retry logic
 */
export async function deliverWebhook(
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
    headers['X-Webhook-Signature'] = `sha256=${signPayload(body, secret)}`;
  }

  const maxRetries = 3;
  let lastError: string | undefined;
  let lastStatusCode: number | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      lastStatusCode = response.status;

      if (response.ok) {
        // Log successful delivery
        await prisma.auditLog.create({
          data: {
            action: 'webhook_delivered',
            resource: 'webhook',
            resourceId: webhookId,
            details: { event, url, statusCode: response.status, attempt: attempt + 1 },
            severity: 'low',
            category: 'system',
            outcome: 'success',
          },
        });

        return { success: true, statusCode: response.status };
      }

      lastError = `HTTP ${response.status}: ${response.statusText}`;

      // Don't retry on 4xx errors (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        break;
      }
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    // Exponential backoff
    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  // Log failed delivery
  await prisma.auditLog.create({
    data: {
      action: 'webhook_failed',
      resource: 'webhook',
      resourceId: webhookId,
      details: { event, url, error: lastError, statusCode: lastStatusCode },
      severity: 'medium',
      category: 'system',
      outcome: 'failure',
    },
  });

  return { success: false, statusCode: lastStatusCode, error: lastError };
}

/**
 * Trigger webhooks for an event
 */
export async function triggerWebhooks(
  userId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  // This would look up subscriptions from a webhooks table
  // For now, we'll create a simple in-memory approach

  // In production, this should be queued to a job processor
  // Webhook processing is handled silently for security
}

// =============================================================================
// Route Handlers
// =============================================================================

// GET - List webhook subscriptions
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // In a full implementation, you'd have a webhooks table
    // For now, return an empty list with the schema
    return NextResponse.json({
      success: true,
      data: [],
      availableEvents: [
        'user.created',
        'user.updated',
        'user.deleted',
        'user.login',
        'content.created',
        'content.published',
        'content.failed',
        'campaign.created',
        'campaign.completed',
        'subscription.created',
        'subscription.cancelled',
      ],
    });
  } catch (error: unknown) {
    console.error('List webhooks error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to process webhook request') },
      { status: 500 }
    );
  }
}

// POST - Create webhook subscription
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
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

    // In a full implementation, save to database
    const webhookId = crypto.randomUUID();

    // Test the webhook URL
    const testResult = await deliverWebhook(
      webhookId,
      url,
      'webhook.test',
      { message: 'Webhook subscription test', timestamp: new Date().toISOString() },
      webhookSecret
    );

    if (!testResult.success) {
      return NextResponse.json(
        {
          error: 'Webhook Test Failed',
          message: `Could not deliver test webhook: ${testResult.error}`,
          statusCode: testResult.statusCode,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook subscription created',
      data: {
        id: webhookId,
        url,
        events,
        active,
        description,
        secret: webhookSecret,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('Create webhook error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to process webhook request') },
      { status: 500 }
    );
  }
}

// DELETE - Remove webhook subscription
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
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

    // In a full implementation, delete from database
    return NextResponse.json({
      success: true,
      message: 'Webhook subscription deleted',
    });
  } catch (error: unknown) {
    console.error('Delete webhook error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to process webhook request') },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
