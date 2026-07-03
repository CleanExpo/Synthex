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
// Constants
// =============================================================================

/**
 * Upper bound for a single conversion's revenue. A legitimate affiliate
 * conversion will never exceed this; anything above is treated as malformed or
 * abusive input. Also keeps writes well within total_revenue Decimal(12,2).
 */
const MAX_CONVERSION_REVENUE = 1_000_000;

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

    // Verify webhook signature. FAIL CLOSED: if the secret is not configured,
    // reject the request rather than accepting unsigned, unauthenticated writes
    // to money fields. Mirrors the missing-secret behaviour of the sibling
    // zapier webhook (app/api/webhooks/zapier/route.ts).
    const webhookSecret = process.env.AFFILIATE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.warn(
        'AFFILIATE_WEBHOOK_SECRET not configured — rejecting affiliate webhook (fail closed)'
      );
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 401 }
      );
    }
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      logger.warn('Affiliate webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    // Extract conversion data
    // Support multiple formats from different networks
    const linkId = body.linkId || body.link_id || body.subId || body.sub_id;
    const orderId =
      body.orderId ||
      body.order_id ||
      body.transactionId ||
      body.transaction_id;
    const revenue = parseFloat(
      body.revenue || body.amount || body.commission || '0'
    );

    if (!linkId) {
      return NextResponse.json(
        { error: 'Link ID is required' },
        { status: 400 }
      );
    }

    // Validate revenue: must be a finite, non-negative number within a sane
    // upper bound. A single affiliate conversion above MAX_CONVERSION_REVENUE is
    // treated as malformed/abusive input rather than a real sale. The bound also
    // keeps the value well within the total_revenue Decimal(12,2) column.
    if (
      !Number.isFinite(revenue) ||
      revenue < 0 ||
      revenue > MAX_CONVERSION_REVENUE
    ) {
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
        return NextResponse.json({ error: 'Link not found' }, { status: 404 });
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
    logger.error('Affiliate Webhook error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}
