/**
 * GBP Review Dismiss API
 *
 * POST — Mark an AI draft as dismissed with a reason (brand voice calibration feedback)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { logger } from '@/lib/logger';

const DismissSchema = z.object({
  reason: z.enum(['too_formal', 'wrong_tone', 'inaccurate', 'other']),
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

  const body = await request.json().catch(() => ({}));
  const parsed = DismissSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
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

    await prisma.gBPReview.update({
      where: { id: reviewId },
      data: {
        responseStatus: 'dismissed',
        dismissReason: parsed.data.reason,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('GBP review dismiss error:', error);
    return NextResponse.json(
      { error: 'Failed to dismiss review' },
      { status: 500 }
    );
  }
}
