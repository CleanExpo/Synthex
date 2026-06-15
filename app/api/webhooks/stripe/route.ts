/**
 * Stripe Webhook Route
 *
 * @description Handles Stripe payment webhooks
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - STRIPE_WEBHOOK_SECRET: Stripe webhook signing secret
 *
 * SECURITY: Validates Stripe signature before processing
 *
 * ARCHITECTURE NOTE (2026-02-28):
 * Uses `receiveAndProcess()` (synchronous mode) instead of `receive()` (queue
 * mode) because Vercel serverless functions have no persistent process to poll
 * the event queue.  All webhook handlers execute inline within this request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { webhookHandler } from '@/lib/webhooks';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/observability/sentry-server';

// Ensure Stripe webhook handlers are registered (auto-registers on import)
import '@/lib/stripe/webhook-handlers';

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

    // Process the webhook synchronously (required for serverless)
    const result = await webhookHandler.receiveAndProcess('stripe', rawBody, {
      'stripe-signature': signature,
    });

    if (!result.success) {
      // Distinguish a transient PROCESSING failure (a handler threw — e.g. a DB
      // write for invoice.payment_succeeded / a subscription update failed) from
      // a permanent CLIENT error (bad signature, invalid JSON, unknown event
      // type). A retryable processing failure must return a non-2xx status so
      // Stripe automatically retries — and because the idempotency key was NOT
      // stored, that retry is reprocessed instead of being deduplicated. A 2xx
      // here (or for an unhandled/no-op event) would tell Stripe to stop and the
      // billing change would be lost permanently.
      if (result.retryable) {
        logger.error('Stripe webhook processing failed; signalling retry', {
          eventId: result.eventId,
          error: result.error,
        });
        // Alert on retryable processing failures — a billing-event handler threw
        // (e.g. a subscription/invoice DB write failed). DSN-gated no-op;
        // secret-scrubbed (only the Stripe eventId, never payload/signature).
        captureServerException(new Error(result.error || 'Processing failed'), {
          level: 'error',
          operation: 'webhook/stripe/process',
          tags: { webhook: 'stripe', retryable: true },
          extra: { eventId: result.eventId },
        });
        return NextResponse.json(
          { error: result.error || 'Processing failed', retry: true },
          { status: 500 }
        );
      }

      logger.warn('Stripe webhook rejected', { error: result.error });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    logger.info('Stripe webhook processed', { eventId: result.eventId });

    return NextResponse.json({
      received: true,
      eventId: result.eventId,
    });
  } catch (error) {
    logger.error('Stripe webhook error', { error });
    // Alert on unexpected webhook handler crashes — billing/subscription events
    // are at risk. DSN-gated no-op; secret-scrubbed (no signature/payload).
    captureServerException(error, {
      level: 'error',
      operation: 'webhook/stripe/handler',
      tags: { webhook: 'stripe' },
    });

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
