/**
 * Stripe Webhook Route
 *
 * @description Handles Stripe payment webhooks
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - STRIPE_WEBHOOK_SECRET: Stripe webhook signing secret
 *
 * SECURITY: Validates Stripe signature before processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { webhookHandler } from '@/lib/webhooks';
import { logger } from '@/lib/logger';

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Extract Stripe signature
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      logger.warn('Missing Stripe signature');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Process the webhook
    const result = await webhookHandler.receive('stripe', rawBody, {
      'stripe-signature': signature,
    });

    if (!result.success) {
      logger.warn('Stripe webhook processing failed', { error: result.error });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    logger.info('Stripe webhook received', { eventId: result.eventId });

    return NextResponse.json({
      received: true,
      eventId: result.eventId,
    });
  } catch (error) {
    logger.error('Stripe webhook error', { error });

    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// CONFIG
// ============================================================================

// Disable body parsing to get raw body for signature verification
export const dynamic = 'force-dynamic';
