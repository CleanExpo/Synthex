/**
 * Zapier Inbound Webhook Route
 *
 * @description Receives inbound webhooks from Zapier.
 * POST: Verify HMAC-SHA256 signature, parse payload, forward to internal event queue.
 * GET: Health check endpoint for Zapier.
 *
 * SECURITY: All webhooks must have valid signatures.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - ZAPIER_WEBHOOK_SECRET: HMAC-SHA256 secret for signature verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { eventQueue } from '@/lib/webhooks/event-queue';
import type { WebhookEventType } from '@/lib/webhooks/types';

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

const zapierPayloadSchema = z.object({
  event: z.string().min(1),
  data: z.record(z.unknown()),
  zapier_hook_id: z.string().optional(),
  timestamp: z.union([z.string(), z.number()]).optional(),
});

// ============================================================================
// EVENT MAPPING
// ============================================================================

/** Map Zapier event names to internal WebhookEventType */
const ZAPIER_EVENT_MAP: Record<string, WebhookEventType> = {
  'post.create': 'post.created',
  'post.created': 'post.created',
  'post.publish': 'post.published',
  'post.published': 'post.published',
  'post.update': 'post.updated',
  'post.updated': 'post.updated',
  'post.delete': 'post.deleted',
  'post.deleted': 'post.deleted',
  'engagement.like': 'engagement.like',
  'engagement.comment': 'engagement.comment',
  'engagement.share': 'engagement.share',
  'analytics.report_ready': 'analytics.report_ready',
  'analytics.threshold_alert': 'analytics.threshold_alert',
  'account.connected': 'account.connected',
  'account.disconnected': 'account.disconnected',
};

function mapZapierEvent(event: string): WebhookEventType | null {
  return ZAPIER_EVENT_MAP[event] || null;
}

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

function verifyZapierSignature(
  payload: string,
  signature: string,
  timestamp?: string
): boolean {
  const secret = process.env.ZAPIER_WEBHOOK_SECRET;

  if (!secret) {
    logger.warn('ZAPIER_WEBHOOK_SECRET not configured');
    return false;
  }

  try {
    const signedPayload = timestamp ? `${timestamp}.${payload}` : payload;

    const expectedSignature = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

// ============================================================================
// GET — Health check
// ============================================================================

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

// ============================================================================
// POST — Receive Zapier webhook
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Extract signature and timestamp from headers
    const signature =
      request.headers.get('x-zapier-signature') ||
      request.headers.get('x-synthex-signature') ||
      '';
    const timestamp =
      request.headers.get('x-zapier-timestamp') ||
      request.headers.get('x-synthex-timestamp') ||
      undefined;

    // Verify signature
    if (!signature || !verifyZapierSignature(rawBody, signature, timestamp)) {
      logger.warn('Invalid Zapier webhook signature');
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Parse body
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      logger.warn('Invalid JSON in Zapier webhook payload');
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Validate payload
    const validation = zapierPayloadSchema.safeParse(body);
    if (!validation.success) {
      logger.warn('Invalid Zapier webhook payload schema', {
        issues: validation.error.issues,
      });
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid payload', details: validation.error.issues },
        { status: 400 }
      );
    }

    const payload = validation.data;

    // Map event to internal type
    const internalEventType = mapZapierEvent(payload.event);

    if (!internalEventType) {
      logger.warn('Unknown Zapier event type', { event: payload.event });
      return NextResponse.json(
        { error: 'Bad Request', message: `Unknown event type: ${payload.event}` },
        { status: 400 }
      );
    }

    // Enqueue the event for processing
    const eventId = await eventQueue.enqueue(internalEventType, 'internal', payload.data, {
      correlationId: payload.zapier_hook_id,
    });

    logger.info('Zapier webhook received and enqueued', {
      eventId,
      event: payload.event,
      internalEventType,
      zapierHookId: payload.zapier_hook_id,
    });

    return NextResponse.json({ success: true, eventId });
  } catch (error) {
    logger.error('Zapier webhook processing error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
