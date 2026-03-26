/**
 * Campaigns API Route
 * CRUD operations for marketing campaigns
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import {
  getEffectiveOrganizationId,
  getEffectiveQueryFilter,
} from '@/lib/multi-business/business-scope';
import { z } from 'zod';
import { pushUniteHubEvent } from '@/lib/unite-hub-connector';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis-client';
import { writeDefault } from '@/lib/rate-limit';

const CAMPAIGNS_CACHE_TTL = 60; // seconds

// Node.js runtime required for Prisma
export const runtime = 'nodejs';

// Validation schemas
const campaignCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  platform: z.enum([
    'twitter',
    'linkedin',
    'instagram',
    'facebook',
    'tiktok',
    'threads',
    'multi',
  ]),
  content: z.string().max(10000, 'Content too long').optional(),
  settings: z
    .object({
      hashtags: z.array(z.string()).optional(),
      mentions: z.array(z.string()).optional(),
      scheduledAt: z.string().datetime().optional(),
      targetAudience: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

const campaignUpdateSchema = z
  .object({
    id: z.string().uuid('Invalid campaign ID'),
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(1000).optional(),
    platform: z
      .enum([
        'twitter',
        'linkedin',
        'instagram',
        'facebook',
        'tiktok',
        'threads',
        'multi',
      ])
      .optional(),
    content: z.string().max(10000).optional(),
    settings: z
      .object({
        hashtags: z.array(z.string()).optional(),
        mentions: z.array(z.string()).optional(),
        scheduledAt: z.string().datetime().optional(),
        targetAudience: z.string().optional(),
      })
      .passthrough()
      .optional(),
    status: z
      .enum(['draft', 'scheduled', 'active', 'paused', 'completed', 'archived'])
      .optional(),
  })
  .strict();

// GET /api/campaigns - Get all campaigns for user
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    // Scope query to the user's active org (handles multi-business context automatically)
    const queryFilter = await getEffectiveQueryFilter(userId);

    // Guard: getEffectiveQueryFilter returns {} on invalid org context — an unscoped query
    // would return every campaign in the database. Deny rather than leak cross-tenant data.
    if (Object.keys(queryFilter).length === 0) {
      return NextResponse.json(
        { error: 'No organisation context found' },
        { status: 403 }
      );
    }

    // ── Cache read ──────────────────────────────────────────────────────────
    // Derive orgId from the filter already resolved above — avoids a second DB call.
    const orgId =
      'organizationId' in queryFilter
        ? (queryFilter as { organizationId: string }).organizationId
        : null;
    const cachePrefix = orgId ? `org:${orgId}` : `user:${userId}`;
    const cacheKey = `synthex:cache:campaigns:${cachePrefix}:all`;
    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        return NextResponse.json(JSON.parse(cached));
      }
    } catch {
      // Redis unavailable — fall through to DB
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '100', 10),
      200
    );
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const campaigns = await prisma.campaign.findMany({
      where: queryFilter,
      include: {
        posts: {
          select: {
            id: true,
            status: true,
            platform: true,
            scheduledAt: true,
            publishedAt: true,
          },
          take: 100,
          orderBy: { scheduledAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // ── Cache write ─────────────────────────────────────────────────────────
    try {
      const redis = getRedisClient();
      await redis.set(
        cacheKey,
        JSON.stringify({ campaigns }),
        CAMPAIGNS_CACHE_TTL
      );
    } catch {
      // Non-fatal — response already built
    }

    return NextResponse.json({ campaigns });
  } catch (error: unknown) {
    logger.error('Get campaigns error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

// POST /api/campaigns - Create new campaign
export async function POST(request: NextRequest) {
  return writeDefault(request, async () => {
    try {
      const userId = await getUserIdFromRequestOrCookies(request);
      if (!userId) return unauthorizedResponse();

      const body = await request.json();

      // Validate input
      const validationResult = campaignCreateSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: validationResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const { name, description, platform, content, settings } =
        validationResult.data;

      // Resolve org ID for scoping (null = no active org context)
      const organizationId = await getEffectiveOrganizationId(userId);

      // Create campaign and audit log in a transaction
      const campaign = await prisma.$transaction(async tx => {
        const created = await tx.campaign.create({
          data: {
            name,
            description,
            platform,
            content,
            settings: settings as object | undefined,
            userId,
            organizationId: organizationId ?? undefined,
            status: 'draft',
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'campaign_created',
            resource: 'campaign',
            resourceId: created.id,
            category: 'data',
            outcome: 'success',
            userId,
            details: { campaignName: name, platform },
          },
        });

        return created;
      });

      // ── Cache invalidation ──────────────────────────────────────────────────
      // organizationId already resolved above — no second DB call needed.
      try {
        const redis = getRedisClient();
        const pattern = organizationId
          ? `synthex:cache:campaigns:${organizationId}:*`
          : `synthex:cache:campaigns:${userId}:*`;
        const cacheKeys = await redis.keys(pattern);
        if (cacheKeys.length > 0) await redis.del(cacheKeys);
      } catch {
        /* non-fatal */
      }

      return NextResponse.json({
        success: true,
        campaign,
      });
    } catch (error: unknown) {
      logger.error('Create campaign error:', error);
      return NextResponse.json(
        { error: 'Failed to create campaign' },
        { status: 500 }
      );
    }
  });
}

// PUT /api/campaigns - Update campaign
export async function PUT(request: NextRequest) {
  return writeDefault(request, async () => {
    try {
      const userId = await getUserIdFromRequestOrCookies(request);
      if (!userId) return unauthorizedResponse();

      const body = await request.json();

      // Validate input
      const validationResult = campaignUpdateSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: validationResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const { id, settings, ...restUpdateData } = validationResult.data;

      // Verify ownership
      const existingCampaign = await prisma.campaign.findFirst({
        where: { id, userId },
      });

      if (!existingCampaign) {
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        );
      }

      const campaign = await prisma.campaign.update({
        where: { id },
        data: {
          ...restUpdateData,
          ...(settings !== undefined && { settings: settings as object }),
        },
      });

      // Push campaign lifecycle events to Unite-Hub (fire-and-forget)
      if (
        restUpdateData.status &&
        existingCampaign.status !== restUpdateData.status
      ) {
        if (restUpdateData.status === 'active') {
          void pushUniteHubEvent({
            type: 'campaign.started',
            userId,
            campaignId: id,
          });
        } else if (restUpdateData.status === 'completed') {
          void pushUniteHubEvent({
            type: 'campaign.completed',
            userId,
            campaignId: id,
          });
        }
      }

      // ── Cache invalidation ──────────────────────────────────────────────────
      // existingCampaign already has organizationId — no extra DB call needed.
      try {
        const redis = getRedisClient();
        const bustOrgId = existingCampaign.organizationId;
        const pattern = bustOrgId
          ? `synthex:cache:campaigns:${bustOrgId}:*`
          : `synthex:cache:campaigns:${userId}:*`;
        const cacheKeys = await redis.keys(pattern);
        if (cacheKeys.length > 0) await redis.del(cacheKeys);
      } catch {
        /* non-fatal */
      }

      return NextResponse.json({
        success: true,
        campaign,
      });
    } catch (error: unknown) {
      logger.error('Update campaign error:', error);
      return NextResponse.json(
        { error: 'Failed to update campaign' },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/campaigns - Delete campaign
export async function DELETE(request: NextRequest) {
  return writeDefault(request, async () => {
    try {
      const userId = await getUserIdFromRequestOrCookies(request);
      if (!userId) return unauthorizedResponse();

      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (!id) {
        return NextResponse.json(
          { error: 'Campaign ID is required' },
          { status: 400 }
        );
      }

      // Verify ownership
      const campaign = await prisma.campaign.findFirst({
        where: { id, userId },
      });

      if (!campaign) {
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        );
      }

      // Delete campaign and log in a transaction
      await prisma.$transaction(async tx => {
        await tx.campaign.delete({
          where: { id },
        });

        await tx.auditLog.create({
          data: {
            action: 'campaign_deleted',
            resource: 'campaign',
            resourceId: id,
            category: 'data',
            outcome: 'success',
            userId,
            details: { campaignName: campaign.name },
          },
        });
      });

      // ── Cache invalidation ──────────────────────────────────────────────────
      // campaign.organizationId is already resolved from the ownership check above.
      try {
        const redis = getRedisClient();
        const bustOrgId = campaign.organizationId;
        const pattern = bustOrgId
          ? `synthex:cache:campaigns:${bustOrgId}:*`
          : `synthex:cache:campaigns:${userId}:*`;
        const cacheKeys = await redis.keys(pattern);
        if (cacheKeys.length > 0) await redis.del(cacheKeys);
      } catch {
        /* non-fatal */
      }

      return NextResponse.json({
        success: true,
        message: 'Campaign deleted successfully',
      });
    } catch (error: unknown) {
      logger.error('Delete campaign error:', error);
      return NextResponse.json(
        { error: 'Failed to delete campaign' },
        { status: 500 }
      );
    }
  });
}
