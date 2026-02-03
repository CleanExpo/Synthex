/**
 * Platform Webhook Route
 *
 * @description Handles incoming webhooks from social platforms
 *
 * SECURITY: All webhooks must have valid signatures
 */

import { NextRequest, NextResponse } from 'next/server';
import { webhookHandler } from '@/lib/webhooks';
import { logger } from '@/lib/logger';

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * GET - Webhook verification (required by some platforms)
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
 * POST - Receive webhook events
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Extract headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Validate platform
    const validPlatforms = [
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

    if (!validPlatforms.includes(platform)) {
      logger.warn('Invalid webhook platform', { platform });
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }

    // Process the webhook
    const result = await webhookHandler.receive(
      platform as Parameters<typeof webhookHandler.receive>[0],
      rawBody,
      headers
    );

    if (!result.success) {
      logger.warn('Webhook processing failed', { platform, error: result.error });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    logger.info('Webhook received', { platform, eventId: result.eventId });

    return NextResponse.json({
      success: true,
      eventId: result.eventId,
    });
  } catch (error) {
    logger.error('Webhook error', { platform, error });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
