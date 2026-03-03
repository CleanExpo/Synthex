/**
 * Internal Webhook Route
 *
 * @description Handles internal system webhooks
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - INTERNAL_WEBHOOK_SECRET: Secret for internal webhook authentication
 *
 * SECURITY: Validates signature and timestamp
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { webhookHandler, emit } from '@/lib/webhooks';
import { logger } from '@/lib/logger';
import type { WebhookEventType } from '@/lib/webhooks/types';

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

const emitEventSchema = z.object({
  type: z.string().min(1),
  data: z.record(z.unknown()),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  priority: z.number().optional(),
  delay: z.number().optional(),
});

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * POST - Receive internal webhook events
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Extract signature and timestamp
    const signature = request.headers.get('x-synthex-signature');
    const timestamp = request.headers.get('x-synthex-timestamp');

    if (!signature || !timestamp) {
      logger.warn('Missing internal webhook headers');
      return NextResponse.json(
        { error: 'Missing signature or timestamp' },
        { status: 400 }
      );
    }

    // Process the webhook
    const result = await webhookHandler.receive('internal', rawBody, {
      'x-synthex-signature': signature,
      'x-synthex-timestamp': timestamp,
    });

    if (!result.success) {
      logger.warn('Internal webhook processing failed', { error: result.error });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    logger.info('Internal webhook received', { eventId: result.eventId });

    return NextResponse.json({
      success: true,
      eventId: result.eventId,
    });
  } catch (error) {
    logger.error('Internal webhook error', { error });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Emit an internal event (for internal services)
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify internal API key
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.INTERNAL_API_KEY;

    if (!expectedKey || !apiKey || !safeCompare(apiKey, expectedKey)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    const validation = emitEventSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const body = validation.data;

    // Emit the event
    const eventId = await emit(
      body.type as WebhookEventType,
      body.data,
      {
        userId: body.userId,
        organizationId: body.organizationId,
        priority: body.priority,
        delay: body.delay,
      }
    );

    logger.info('Internal event emitted', { eventId, type: body.type });

    return NextResponse.json({
      success: true,
      eventId,
    });
  } catch (error) {
    logger.error('Internal event emit error', { error });

    return NextResponse.json(
      { error: 'Failed to emit event' },
      { status: 500 }
    );
  }
}
