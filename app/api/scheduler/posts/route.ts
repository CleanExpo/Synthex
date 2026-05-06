/**
 * Content Scheduler API
 *
 * Schedule and manage posts for publishing across platforms.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/scheduler/posts/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// =============================================================================
// Schemas
// =============================================================================

const listPostsQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  status: z
    .enum(['draft', 'scheduled', 'published', 'failed', 'all'])
    .optional()
    .default('all'),
  platform: z.string().optional(),
  batchId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z
    .enum(['scheduledAt', 'createdAt', 'publishedAt'])
    .optional()
    .default('scheduledAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

const createPostSchema = z.object({
  content: z.string().min(1).max(10000),
  platform: z.string(),
  scheduledAt: z.string().datetime(),
  campaignId: z.string().optional(),
  // HER-1a / SYN-909: status and source are optional on create.
  // Default behaviour unchanged — omitted status still becomes 'scheduled'.
  // HERMES POSTs with status='pending_approval' and source='hermes'.
  status: z
    .enum(['draft', 'scheduled', 'published', 'failed', 'pending_approval'])
    .optional(),
  source: z.enum(['hermes', 'autopilot']).optional(),
  metadata: z
    .object({
      images: z.array(z.string()).optional(),
      hashtags: z.array(z.string()).optional(),
      mentions: z.array(z.string()).optional(),
      persona: z.string().optional(),
      estimatedEngagement: z.number().optional(),
      batchId: z.string().optional(),
    })
    .optional(),
});

const updatePostSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  platform: z.string().optional(),
  status: z
    .enum(['draft', 'scheduled', 'published', 'failed', 'pending_approval'])
    .optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  metadata: z
    .object({
      images: z.array(z.string()).optional(),
      hashtags: z.array(z.string()).optional(),
      mentions: z.array(z.string()).optional(),
      persona: z.string().optional(),
      estimatedEngagement: z.number().optional(),
      engagement: z
        .object({
          likes: z.number().optional(),
          comments: z.number().optional(),
          shares: z.number().optional(),
          views: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});

// =============================================================================
// Auth Helper - Uses centralized JWT utilities (no fallback secrets)
// =============================================================================

import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis-client';

const SCHEDULER_POSTS_CACHE_TTL = 60; // seconds

// Get user's campaign IDs for authorization
async function getUserCampaignIds(userId: string): Promise<string[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { userId },
    select: { id: true },
    take: 200,
  });
  return campaigns.map(c => c.id);
}

// =============================================================================
// GET - List Scheduled Posts
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      query[key] = value;
    });

    const validation = listPostsQuerySchema.safeParse(query);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const {
      page,
      limit,
      status,
      platform,
      batchId,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    } = validation.data;
    const skip = (page - 1) * limit;

    // ── Cache read ──────────────────────────────────────────────────────────
    const paramParts = [
      `page=${page}`,
      `limit=${limit}`,
      `status=${status}`,
      ...(platform ? [`platform=${platform}`] : []),
      ...(batchId ? [`batchId=${batchId}`] : []),
      ...(startDate ? [`startDate=${startDate}`] : []),
      ...(endDate ? [`endDate=${endDate}`] : []),
      `sortBy=${sortBy}`,
      `sortOrder=${sortOrder}`,
    ].sort();
    const paramsHash = paramParts.join('&');
    const cacheKey = `synthex:cache:scheduler-posts:${userId}:${paramsHash}`;
    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        return NextResponse.json(JSON.parse(cached));
      }
    } catch {
      // Redis unavailable — fall through to DB
    }

    // Get user's campaign IDs
    const campaignIds = await getUserCampaignIds(userId);

    // Build where clause — always exclude soft-deleted posts
    const where: Record<string, unknown> = {
      campaignId: { in: campaignIds },
      deletedAt: null,
    };

    if (status !== 'all') {
      where.status = status;
    }

    if (platform) {
      where.platform = platform;
    }

    // Filter by batchId stored in metadata JSON (PostgreSQL JSON path filter)
    if (batchId) {
      where.metadata = { path: ['batchId'], equals: batchId };
    }

    if (startDate || endDate) {
      where.scheduledAt = {};
      if (startDate) {
        (where.scheduledAt as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.scheduledAt as Record<string, Date>).lte = new Date(endDate);
      }
    }

    // count and findMany are independent — run in parallel
    const [total, posts] = await Promise.all([
      prisma.post.count({ where }),
      prisma.post.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    // Calculate stats
    const stats = {
      scheduled: await prisma.post.count({
        where: { ...where, status: 'scheduled' },
      }),
      published: await prisma.post.count({
        where: { ...where, status: 'published' },
      }),
      draft: await prisma.post.count({
        where: { ...where, status: 'draft' },
      }),
      failed: await prisma.post.count({
        where: { ...where, status: 'failed' },
      }),
    };

    const responseData = {
      data: posts,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // ── Cache write ─────────────────────────────────────────────────────────
    try {
      const redis = getRedisClient();
      await redis.set(
        cacheKey,
        JSON.stringify(responseData),
        SCHEDULER_POSTS_CACHE_TTL
      );
    } catch {
      // Non-fatal — response already built
    }

    return NextResponse.json(responseData);
  } catch (error) {
    logger.error('Error fetching scheduled posts:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Schedule New Post
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = createPostSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Resolve organization context for multi-business support
    const organizationId = await getEffectiveOrganizationId(userId);

    // Get or create default campaign (scoped to active organization)
    let campaignId = data.campaignId;
    if (!campaignId) {
      // Find or create a default scheduled posts campaign for this org context
      let defaultCampaign = await prisma.campaign.findFirst({
        where: {
          userId,
          name: 'Scheduled Posts',
          ...(organizationId ? { organizationId } : { organizationId: null }),
        },
      });

      if (!defaultCampaign) {
        defaultCampaign = await prisma.campaign.create({
          data: {
            userId,
            name: 'Scheduled Posts',
            description: 'Default campaign for scheduled posts',
            platform: 'multi',
            status: 'active',
            ...(organizationId ? { organizationId } : {}),
          },
        });
      }
      campaignId = defaultCampaign.id;
    } else {
      // Verify campaign ownership
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { userId: true },
      });

      if (!campaign || campaign.userId !== userId) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Campaign not found or not owned' },
          { status: 403 }
        );
      }
    }

    const post = await prisma.post.create({
      data: {
        content: data.content,
        platform: data.platform,
        // HER-1a / SYN-909: respect client-provided status (HERMES uses 'pending_approval')
        // before falling back to the original default of 'scheduled'.
        status: data.status ?? 'scheduled',
        // HER-1a / SYN-909: respect client-provided source (HERMES uses 'hermes').
        // Omit when undefined so the column stays NULL (= 'human').
        ...(data.source !== undefined ? { source: data.source } : {}),
        scheduledAt: new Date(data.scheduledAt),
        metadata: data.metadata || {},
        campaignId,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // ── Cache invalidation ──────────────────────────────────────────────────
    try {
      const redis = getRedisClient();
      const cacheKeys = await redis.keys(
        `synthex:cache:scheduler-posts:${userId}:*`
      );
      if (cacheKeys.length > 0) await redis.del(cacheKeys);
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ data: post }, { status: 201 });
  } catch (error) {
    logger.error('Error scheduling post:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to schedule post' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update Scheduled Post
// =============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Validation Error', message: 'Post ID is required' },
        { status: 400 }
      );
    }

    const validation = updatePostSchema.safeParse(updateData);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    // Verify ownership through campaign
    const existingPost = await prisma.post.findUnique({
      where: { id },
      include: {
        campaign: {
          select: { userId: true },
        },
      },
    });

    if (!existingPost || existingPost.campaign.userId !== userId) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Post not found' },
        { status: 404 }
      );
    }

    const data = validation.data;
    const updatePayload: Record<string, unknown> = { ...data };

    if (data.scheduledAt !== undefined) {
      updatePayload.scheduledAt = data.scheduledAt
        ? new Date(data.scheduledAt)
        : null;
    }

    if (data.status === 'published') {
      updatePayload.publishedAt = new Date();
    }

    const post = await prisma.post.update({
      where: { id },
      data: updatePayload,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // ── Cache invalidation ──────────────────────────────────────────────────
    try {
      const redis = getRedisClient();
      const cacheKeys = await redis.keys(
        `synthex:cache:scheduler-posts:${userId}:*`
      );
      if (cacheKeys.length > 0) await redis.del(cacheKeys);
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ data: post });
  } catch (error) {
    logger.error('Error updating post:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to update post' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete Scheduled Post
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Validation Error', message: 'Post ID is required' },
        { status: 400 }
      );
    }

    // Require explicit confirmation body before hard-delete
    const confirmBodySchema = z.object({ confirm: z.literal(true) });
    const rawBody = await request.json().catch(() => ({}));
    const confirmParsed = confirmBodySchema.safeParse(rawBody);
    if (!confirmParsed.success) {
      return NextResponse.json(
        {
          error: 'Confirmation required',
          details: 'Send { confirm: true } to delete',
        },
        { status: 400 }
      );
    }

    // Verify ownership through campaign
    const existingPost = await prisma.post.findUnique({
      where: { id },
      include: {
        campaign: {
          select: { userId: true },
        },
      },
    });

    if (!existingPost || existingPost.campaign.userId !== userId) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Post not found' },
        { status: 404 }
      );
    }

    await prisma.post.delete({ where: { id } });

    // ── Cache invalidation ──────────────────────────────────────────────────
    try {
      const redis = getRedisClient();
      const cacheKeys = await redis.keys(
        `synthex:cache:scheduler-posts:${userId}:*`
      );
      if (cacheKeys.length > 0) await redis.del(cacheKeys);
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting post:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to delete post' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
