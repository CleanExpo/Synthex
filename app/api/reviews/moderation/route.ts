/**
 * GET /api/reviews/moderation
 *
 * Returns GBPReview items for the authenticated organisation's moderation queue.
 * Supports filtering by status and pagination.
 *
 * Query params:
 *   status  — 'pending' | 'approved' | 'rejected' | 'hidden' | 'all' (default 'all')
 *   page    — 1-based page number (default 1)
 *   limit   — items per page (default 20, max 50)
 *
 * @task UNI-1642
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

const VALID_STATUSES = ['pending', 'approved', 'rejected', 'hidden'] as const;
type ReviewStatus = (typeof VALID_STATUSES)[number];

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 403 }
    );
  }

  const { organizationId } = user;

  // ── Query params ──────────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status') ?? 'all';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get('limit') ?? '20'))
  );
  const skip = (page - 1) * limit;

  const statusFilter =
    statusParam !== 'all' &&
    VALID_STATUSES.includes(statusParam as ReviewStatus)
      ? { status: statusParam as ReviewStatus }
      : {};

  try {
    const [reviews, total] = await Promise.all([
      prisma.gBPReview.findMany({
        where: {
          organizationId,
          ...statusFilter,
        },
        orderBy: [
          { status: 'asc' }, // pending first (a < h < p < r alphabetically — close enough)
          { reviewTime: 'desc' },
        ],
        skip,
        take: limit,
        select: {
          id: true,
          reviewerName: true,
          reviewerAvatar: true,
          rating: true,
          comment: true,
          reviewTime: true,
          status: true,
          isFeatured: true,
          displayOnWidget: true,
          widgetOrder: true,
          sentiment: true,
          moderatedBy: true,
          moderatedAt: true,
          location: {
            select: { locationName: true },
          },
        },
      }),

      prisma.gBPReview.count({
        where: {
          organizationId,
          ...statusFilter,
        },
      }),
    ]);

    return NextResponse.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error('GET /api/reviews/moderation failed', {
      error: err,
      orgId: organizationId,
    });
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}
