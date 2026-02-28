/**
 * Dynamic Platform Webhook Route — /api/webhooks/[platform]
 *
 * @description Handles incoming webhooks from social platforms via dynamic
 * route segment. Delegates to the centralised WebhookHandler for signature
 * verification, event parsing, and handler dispatch.
 *
 * ARCHITECTURE NOTE:
 * Uses `receiveAndProcess()` (synchronous mode) because Vercel serverless
 * functions have no persistent process to poll an event queue. All registered
 * handlers execute inline within the HTTP request.
 *
 * SECURITY: All webhooks must have valid signatures verified via
 * the SignatureVerifier before any processing occurs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { webhookHandler } from '@/lib/webhooks';
import { logger } from '@/lib/logger';
import type { WebhookPlatform } from '@/lib/webhooks/types';

// Ensure social webhook handlers are registered (auto-registers on import)
import '@/lib/webhooks/social-webhook-handlers';

// ============================================================================
// CONSTANTS
// ============================================================================

const VALID_PLATFORMS: readonly string[] = [
  'twitter',
  'facebook',
  'instagram',
  'tiktok',
  'linkedin',
  'pinterest',
  'youtube',
  'threads',
  'reddit',
];

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * GET - Webhook verification (required by some platforms)
 *
 * - Facebook/Instagram/Threads: hub.mode=subscribe challenge
 * - Twitter/X: CRC token challenge-response
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const searchParams = request.nextUrl.searchParams;

  // Facebook/Meta verification
  if (platform === 'facebook' || platform === 'instagram' || platform === 'threads') {
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('Meta webhook verified', { platform });
      return new NextResponse(challenge, { status: 200 });
    }

    logger.warn('Meta webhook verification failed', { platform, mode });
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
  }

  // Twitter CRC check
  if (platform === 'twitter') {
    const crcToken = searchParams.get('crc_token');

    if (crcToken) {
      const crypto = await import('crypto');
      const secret = process.env.TWITTER_WEBHOOK_SECRET || '';
      const hash = crypto.createHmac('sha256', secret).update(crcToken).digest('base64');

      return NextResponse.json({
        response_token: `sha256=${hash}`,
      });
    }
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

/**
 * POST - Receive and process webhook events
 *
 * Signature verification, event type parsing, and handler dispatch are all
 * performed synchronously via `webhookHandler.receiveAndProcess()`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;

  try {
    // Validate platform
    if (!VALID_PLATFORMS.includes(platform)) {
      logger.warn('Invalid webhook platform', { platform });
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }

    // Get raw body for signature verification
    const rawBody = await request.text();

    if (!rawBody) {
      return NextResponse.json(
        { error: 'Empty request body' },
        { status: 400 }
      );
    }

    // Extract headers into plain object
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Process the webhook synchronously (required for serverless)
    const result = await webhookHandler.receiveAndProcess(
      platform as WebhookPlatform,
      rawBody,
      headers
    );

    if (!result.success) {
      // Distinguish auth errors from processing errors
      const isAuthError =
        result.error?.includes('signature') ||
        result.error?.includes('Missing signature');

      if (isAuthError) {
        logger.warn('Webhook signature verification failed', {
          platform,
          error: result.error,
        });
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Invalid signature' },
          { status: 401 }
        );
      }

      logger.warn('Webhook processing failed', { platform, error: result.error });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    logger.info('Webhook processed', { platform, eventId: result.eventId });

    return NextResponse.json({
      success: true,
      eventId: result.eventId,
    });
  } catch (error) {
    logger.error('Webhook error', {
      platform,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// CONFIG
// ============================================================================

export const dynamic = 'force-dynamic';
