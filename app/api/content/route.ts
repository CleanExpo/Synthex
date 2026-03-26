/**
 * Content Collection Route
 *
 * Returns posts for the authenticated user, optionally filtered by status and/or platform.
 * Used by useContent() hook in the dashboard.
 *
 * @route GET /api/content?status=<status>&platform=<platform>
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const platform = searchParams.get('platform') || undefined;

    const paginationResult = paginationSchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });
    if (!paginationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid pagination parameters',
          details: paginationResult.error.issues,
        },
        { status: 400 }
      );
    }
    const { page, limit } = paginationResult.data;
    const skip = (page - 1) * limit;

    const organizationId = await getEffectiveOrganizationId(userId);
    const ownerFilter = organizationId ? { organizationId } : { userId };

    const whereClause = {
      campaign: { ...ownerFilter },
      ...(status ? { status } : {}),
      ...(platform ? { platform } : {}),
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: whereClause,
        select: {
          id: true,
          content: true,
          platform: true,
          status: true,
          scheduledAt: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          metadata: true,
          campaign: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.post.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('[Content] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
