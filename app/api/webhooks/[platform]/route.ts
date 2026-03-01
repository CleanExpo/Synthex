/**
 * Platform Webhook Route
 *
 * @description Handles incoming webhooks from all 9 social platforms:
 * Twitter/X, Facebook, Instagram, Threads, TikTok, LinkedIn, Pinterest, YouTube, Reddit
 *
 * GET  — Webhook verification (CRC for Twitter, hub.verify for Meta, challenge for LinkedIn)
 * POST — Receive and process webhook events with signature verification
 *
 * SECURITY: All webhooks must have valid signatures verified via lib/webhooks/signature-verifier.ts
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - TWITTER_WEBHOOK_SECRET (SECRET)
 * - META_WEBHOOK_SECRET (SECRET) — shared by Facebook, Instagram, Threads
 * - META_WEBHOOK_VERIFY_TOKEN — for Meta subscription verification
 * - LINKEDIN_WEBHOOK_SECRET (SECRET)
 * - TIKTOK_WEBHOOK_SECRET (SECRET)
 * - PINTEREST_WEBHOOK_SECRET (SECRET)
 * - GOOGLE_WEBHOOK_SECRET (SECRET) — for YouTube
 * - REDDIT_WEBHOOK_SECRET (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import { webhookHandler } from '@/lib/webhooks';
import { logger } from '@/lib/logger';

// ============================================================================
// VALID PLATFORMS
// ============================================================================

const VALID_PLATFORMS = new Set([
  'twitter',
  'facebook',
  'instagram',
  'tiktok',
  'linkedin',
  'pinterest',
  'youtube',
  'threads',
  'reddit',
]);

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * GET - Webhook verification (required by some platforms)
 *
 * - Facebook/Instagram/Threads: hub.mode=subscribe verification
 * - Twitter/X: CRC challenge-response
 * - LinkedIn: Challenge-response verification
 * - Pinterest: Verification challenge
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const searchParams = request.nextUrl.searchParams;

  // Facebook/Instagram/Threads — Meta webhook subscription verification
  if (platform === 'facebook' || platform === 'instagram' || platform === 'threads') {
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (!verifyToken) {
      logger.error('META_WEBHOOK_VERIFY_TOKEN not configured', { platform });
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('Meta webhook verified', { platform });
      return new NextResponse(challenge, { status: 200 });
    }

    logger.warn('Meta webhook verification failed', { platform, mode });
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
  }

  // Twitter/X — CRC (Challenge-Response Check)
  if (platform === 'twitter') {
    const crcToken = searchParams.get('crc_token');

    if (crcToken) {
      const secret = process.env.TWITTER_WEBHOOK_SECRET;

      if (!secret) {
        logger.error('TWITTER_WEBHOOK_SECRET not configured');
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
      }

      const crypto = await import('crypto');
      const hash = crypto.createHmac('sha256', secret).update(crcToken).digest('base64');

      return NextResponse.json({
        response_token: `sha256=${hash}`,
      });
    }
  }

  // LinkedIn — webhook verification challenge
  if (platform === 'linkedin') {
    const challengeCode = searchParams.get('challengeCode');

    if (challengeCode) {
      logger.info('LinkedIn webhook challenge verified');
      return NextResponse.json({
        challengeCode,
      });
    }
  }

  // Pinterest — verification challenge
  if (platform === 'pinterest') {
    const challenge = searchParams.get('challenge');

    if (challenge) {
      logger.info('Pinterest webhook challenge verified');
      return new NextResponse(challenge, { status: 200 });
    }
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

/**
 * POST - Receive webhook events
 *
 * Flow:
 * 1. Validate platform name
 * 2. Extract raw body and headers
 * 3. Delegate to webhookHandler.receive() which handles:
 *    a. Signature verification (platform-specific)
 *    b. Idempotency check (Redis-backed deduplication)
 *    c. Event type parsing (platform-specific payload structure)
 *    d. Event queue enqueue for async processing
 *    e. Audit trail logging
 * 4. Return 200 OK to acknowledge receipt (even on processing errors,
 *    to prevent platforms from retrying indefinitely)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;

  // Validate platform early
  if (!VALID_PLATFORMS.has(platform)) {
    logger.warn('Invalid webhook platform', { platform });
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  }

  try {
    // Get raw body for signature verification — must read before parsing
    const rawBody = await request.text();

    if (!rawBody) {
      logger.warn('Empty webhook body', { platform });
      return NextResponse.json({ error: 'Empty body' }, { status: 400 });
    }

    // Extract all headers as a plain record for the handler
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Process the webhook through the central handler
    const result = await webhookHandler.receive(
      platform as Parameters<typeof webhookHandler.receive>[0],
      rawBody,
      headers
    );

    if (!result.success) {
      // Distinguish between auth failures and processing errors
      const isAuthError = result.error?.includes('signature') || result.error?.includes('Missing signature');
      const statusCode = isAuthError ? 401 : 400;

      logger.warn('Webhook processing failed', { platform, error: result.error });
      return NextResponse.json(
        { error: result.error },
        { status: statusCode }
      );
    }

    logger.info('Webhook received', { platform, eventId: result.eventId });

    return NextResponse.json({
      success: true,
      eventId: result.eventId,
    });
  } catch (error) {
    logger.error('Webhook error', { platform, error });

    // Return 200 to prevent platform retry storms on internal errors.
    // The event was not processed, but we don't want the platform to
    // keep hammering us with retries on a server-side issue.
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 200 }
    );
  }
}

// ============================================================================
// CONFIG
// ============================================================================

// Disable body parsing to get raw body for signature verification
export const dynamic = 'force-dynamic';
