/**
 * Social Platform Webhook Route
 *
 * Handles incoming webhooks from social media platforms for
 * post engagement updates, publishing confirmations, and errors.
 *
 * Uses the centralised WebhookHandler infrastructure with:
 * - Per-platform signature verification (timing-safe HMAC)
 * - Typed event parsing and routing
 * - Handler registration via auto-import
 *
 * Platforms supported: Twitter/X, Facebook, Instagram, Threads, LinkedIn,
 * TikTok, YouTube, Pinterest, Reddit.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - TWITTER_WEBHOOK_SECRET
 * - META_WEBHOOK_SECRET (Facebook, Instagram, Threads)
 * - LINKEDIN_WEBHOOK_SECRET
 * - TIKTOK_WEBHOOK_SECRET
 * - META_WEBHOOK_VERIFY_TOKEN (for GET verification challenge)
 * - DATABASE_URL (CRITICAL)
 *
 * ARCHITECTURE NOTE:
 * Uses `receiveAndProcess()` (synchronous mode) because Vercel serverless
 * functions have no persistent process to poll an event queue. All registered
 * handlers execute inline within the HTTP request, matching the Stripe
 * webhook route pattern.
 *
 * @module app/api/webhooks/social/route
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

/** Platforms that can send webhooks to this endpoint */
const VALID_PLATFORMS: WebhookPlatform[] = [
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
// GET — Webhook Verification
// ============================================================================

/**
 * Handle verification challenges from platforms.
 *
 * - Facebook/Instagram/Threads: hub.mode=subscribe verification
 * - Twitter/X: CRC token challenge-response
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // ------------------------------------------------------------------
  // Facebook / Instagram / Threads verification challenge
  // ------------------------------------------------------------------
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && challenge) {
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (token === verifyToken) {
      logger.info('Meta webhook verification succeeded');
      return new NextResponse(challenge, { status: 200 });
    }

    logger.warn('Meta webhook verification failed — token mismatch');
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
  }

  // ------------------------------------------------------------------
  // Twitter/X CRC challenge
  // ------------------------------------------------------------------
  const crcToken = searchParams.get('crc_token');

  if (crcToken) {
    const secret = process.env.TWITTER_WEBHOOK_SECRET;

    if (!secret) {
      logger.warn('Twitter CRC challenge received but TWITTER_WEBHOOK_SECRET not set');
      return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const crypto = await import('crypto');
    const hash = crypto.createHmac('sha256', secret).update(crcToken).digest('base64');

    return NextResponse.json({ response_token: `sha256=${hash}` });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

// ============================================================================
// POST — Receive Webhook Events
// ============================================================================

/**
 * Receive and process a webhook event from a social platform.
 *
 * The platform is identified via the `?platform=` query parameter.
 * Signature verification, event parsing, and handler dispatch are all
 * delegated to the centralised `WebhookHandler`.
 */
export async function POST(request: NextRequest) {
  try {
    // Determine which platform sent this webhook
    const platformParam = request.nextUrl.searchParams.get('platform')?.toLowerCase();

    if (!platformParam) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Missing ?platform= query parameter' },
        { status: 400 }
      );
    }

    if (!VALID_PLATFORMS.includes(platformParam as WebhookPlatform)) {
      logger.warn('Invalid webhook platform', { platform: platformParam });
      return NextResponse.json(
        { error: 'Bad Request', message: `Unsupported platform: ${platformParam}` },
        { status: 400 }
      );
    }

    const platform = platformParam as WebhookPlatform;

    // Read raw body for signature verification (must happen before JSON parsing)
    const rawBody = await request.text();

    if (!rawBody) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Empty request body' },
        { status: 400 }
      );
    }

    // Collect headers into a plain object for the handler
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Delegate to the centralised handler (signature verification + event
    // parsing + handler dispatch all happen inside receiveAndProcess)
    const result = await webhookHandler.receiveAndProcess(platform, rawBody, headers);

    if (!result.success) {
      // Distinguish between auth failures and other errors
      const isAuthError =
        result.error?.includes('signature') ||
        result.error?.includes('Missing signature');

      if (isAuthError) {
        logger.warn('Webhook signature verification failed', {
          platform,
          error: result.error,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
        });
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Invalid signature' },
          { status: 401 }
        );
      }

      logger.warn('Webhook processing failed', { platform, error: result.error });
      return NextResponse.json(
        { error: 'Bad Request', message: result.error },
        { status: 400 }
      );
    }

    logger.info('Social webhook processed', {
      platform,
      eventId: result.eventId,
    });

    return NextResponse.json({
      success: true,
      eventId: result.eventId,
    });
  } catch (error) {
    logger.error('Social webhook error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Return 500 for unexpected errors — platforms will retry
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// CONFIG
// ============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
