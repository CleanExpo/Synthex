/**
 * GBP Review Reply API
 *
 * POST   — Send reply to a review
 * DELETE — Delete reply from a review
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { findOAuthConnection } from '@/lib/google/google-auth';
import {
  replyToReview,
  deleteReviewReply,
} from '@/lib/google/business-profile';
import { logger } from '@/lib/logger';

const ReplySchema = z.object({
  text: z.string().min(1, 'Reply text is required').max(4096, 'Reply too long'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);
  const { reviewId } = await params;

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const parsed = ReplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const review = await prisma.gBPReview.findFirst({
      where: { id: reviewId, organizationId },
    });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const connectionId = await findOAuthConnection(
      organizationId,
      'googlebusiness'
    );
    if (!connectionId) {
      return NextResponse.json(
        { error: 'No GBP connection found' },
        { status: 400 }
      );
    }

    // Send reply to Google
    await replyToReview(connectionId, review.gbpReviewId, parsed.data.text);

    // Update local record
    await prisma.gBPReview.update({
      where: { id: reviewId },
      data: {
        replyText: parsed.data.text,
        replyTime: new Date(),
        responseStatus: 'posted',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Reply sent successfully',
    });
  } catch (error) {
    logger.error('GBP review reply error:', error);
    return NextResponse.json(
      { error: 'Failed to send reply' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);
  const { reviewId } = await params;

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  try {
    const review = await prisma.gBPReview.findFirst({
      where: { id: reviewId, organizationId },
    });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const connectionId = await findOAuthConnection(
      organizationId,
      'googlebusiness'
    );
    if (!connectionId) {
      return NextResponse.json(
        { error: 'No GBP connection found' },
        { status: 400 }
      );
    }

    await deleteReviewReply(connectionId, review.gbpReviewId);

    await prisma.gBPReview.update({
      where: { id: reviewId },
      data: {
        replyText: null,
        replyTime: null,
      },
    });

    return NextResponse.json({ success: true, message: 'Reply deleted' });
  } catch (error) {
    logger.error('GBP review reply delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete reply' },
      { status: 500 }
    );
  }
}
