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

// =============================================================================
// Schemas
// =============================================================================

const listPostsQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  status: z.enum(['draft', 'scheduled', 'published', 'failed', 'all']).optional().default('all'),
  platform: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(['scheduledAt', 'createdAt', 'publishedAt']).optional().default('scheduledAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

const createPostSchema = z.object({
  content: z.string().min(1).max(10000),
  platform: z.string(),
  scheduledAt: z.string().datetime(),
  campaignId: z.string().optional(),
  metadata: z.object({
    images: z.array(z.string()).optional(),
    hashtags: z.array(z.string()).optional(),
    mentions: z.array(z.string()).optional(),
    persona: z.string().optional(),
    estimatedEngagement: z.number().optional(),
  }).optional(),
});

const updatePostSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  platform: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'published', 'failed']).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  metadata: z.object({
    images: z.array(z.string()).optional(),
    hashtags: z.array(z.string()).optional(),
    mentions: z.array(z.string()).optional(),
    persona: z.string().optional(),
    estimatedEngagement: z.number().optional(),
    engagement: z.object({
      likes: z.number().optional(),
      comments: z.number().optional(),
      shares: z.number().optional(),
      views: z.number().optional(),
    }).optional(),
  }).optional(),
});

// =============================================================================
// Auth Helper - Uses centralized JWT utilities (no fallback secrets)
// =============================================================================

import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

async function getUserId(request: NextRequest): Promise<string | null> {
  return getUserIdFromRequest(request);
}

// Get user's campaign IDs for authorization
async function getUserCampaignIds(userId: string): Promise<string[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { userId },
    select: { id: true },
  });
  return campaigns.map(c => c.id);
}

// =============================================================================
// GET - List Scheduled Posts
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
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

    const { page, limit, status, platform, startDate, endDate, sortBy, sortOrder } = validation.data;
    const skip = (page - 1) * limit;

    // Get user's campaign IDs
    const campaignIds = await getUserCampaignIds(userId);

    // Build where clause
    const where: Record<string, unknown> = {
      campaignId: { in: campaignIds },
    };

    if (status !== 'all') {
      where.status = status;
    }

    if (platform) {
      where.platform = platform;
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

    // Get total count
    const total = await prisma.post.count({ where });

    // Get posts
    const posts = await prisma.post.findMany({
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
    });

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

    return NextResponse.json({
      data: posts,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching scheduled posts:', error);
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
    const userId = await getUserId(request);
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

    // Get or create default campaign
    let campaignId = data.campaignId;
    if (!campaignId) {
      // Find or create a default scheduled posts campaign
      let defaultCampaign = await prisma.campaign.findFirst({
        where: {
          userId,
          name: 'Scheduled Posts',
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
        status: 'scheduled',
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

    return NextResponse.json({ data: post }, { status: 201 });
  } catch (error) {
    console.error('Error scheduling post:', error);
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
    const userId = await getUserId(request);
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
      updatePayload.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
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

    return NextResponse.json({ data: post });
  } catch (error) {
    console.error('Error updating post:', error);
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
    const userId = await getUserId(request);
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting post:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to delete post' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
