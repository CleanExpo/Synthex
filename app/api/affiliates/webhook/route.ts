/**
 * Affiliate Conversion Webhook
 *
 * @description Receive conversion notifications from affiliate networks.
 *
 * POST /api/affiliates/webhook - Record conversion from network webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { AffiliateLinkService } from '@/lib/affiliates/affiliate-link-service';
import crypto from 'crypto';

// =============================================================================
// Webhook Secret Verification
// =============================================================================

function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// =============================================================================
// POST - Record Conversion
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-webhook-signature');

    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.AFFILIATE_WEBHOOK_SECRET;
    if (webhookSecret) {
      if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        logger.warn('Affiliate webhook signature verification failed');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    const body = JSON.parse(rawBody);

    // Extract conversion data
    // Support multiple formats from different networks
    const linkId = body.linkId || body.link_id || body.subId || body.sub_id;
    const orderId = body.orderId || body.order_id || body.transactionId || body.transaction_id;
    const revenue = parseFloat(body.revenue || body.amount || body.commission || '0');

    if (!linkId) {
      return NextResponse.json(
        { error: 'Link ID is required' },
        { status: 400 }
      );
    }

    if (isNaN(revenue) || revenue < 0) {
      return NextResponse.json(
        { error: 'Valid revenue amount is required' },
        { status: 400 }
      );
    }

    // Verify the link exists
    const link = await AffiliateLinkService.getLinkByShortCode(linkId);
    if (!link) {
      // Try finding by ID directly
      try {
        await AffiliateLinkService.recordConversion(linkId, {
          orderId,
          revenue,
        });
      } catch {
        return NextResponse.json(
          { error: 'Link not found' },
          { status: 404 }
        );
      }
    } else {
      await AffiliateLinkService.recordConversion(link.id, {
        orderId,
        revenue,
      });
    }

    logger.info('Affiliate conversion recorded', { linkId, orderId, revenue });

    return NextResponse.json({
      success: true,
      message: 'Conversion recorded',
    });
  } catch (error) {
    logger.error('Affiliate Webhook error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}
