/**
 * POST /api/reviews/request
 *
 * Send a review request email to a client after job completion.
 * Creates a ReviewRequest record and fires a Resend email with the
 * business's Google review link. A follow-up is sent automatically
 * at day 3 by the review-follow-up cron if no review is received.
 *
 * Auth: required (org-scoped)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { sendReviewRequest } from '@/lib/reviews/review-request-service';
import { logger } from '@/lib/logger';

const RequestSchema = z.object({
  locationId: z.string().min(1),
  recipientName: z.string().min(1).max(100),
  recipientEmail: z.string().email(),
});

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const orgId = await getEffectiveOrganizationId(userId);
  if (!orgId) {
    return NextResponse.json(
      { error: 'No organisation context found' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { locationId, recipientName, recipientEmail } = parsed.data;

  try {
    const result = await sendReviewRequest(orgId, locationId, {
      recipientName,
      recipientEmail,
    });

    return NextResponse.json(
      {
        success: true,
        reviewRequestId: result.reviewRequestId,
        message:
          'Review request sent. A follow-up will be sent in 3 days if no review is received.',
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to send review request';
    logger.error('api:reviews:request', { orgId, locationId, error: message });

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('No Google review link')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Failed to send review request' },
      { status: 500 }
    );
  }
}
