/**
 * GBP Reviews API
 *
 * GET — Paginated reviews for a location (from DB, synced by cron)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
  const rating = searchParams.get('rating')
    ? parseInt(searchParams.get('rating')!, 10)
    : undefined;
  const unreplied = searchParams.get('unreplied') === 'true';

  const where: Record<string, unknown> = { organizationId };
  if (locationId) where.locationId = locationId;
  if (rating) where.rating = rating;
  if (unreplied) where.replyText = null;

  const [reviews, total] = await Promise.all([
    prisma.gBPReview.findMany({
      where,
      orderBy: { reviewTime: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { location: { select: { locationName: true } } },
    }),
    prisma.gBPReview.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    reviews,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
