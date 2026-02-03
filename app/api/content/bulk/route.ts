/**
 * Bulk Content Operations
 *
 * Handles bulk create, update, delete, and schedule operations for content.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/content/bulk/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// =============================================================================
// Schemas
// =============================================================================

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  hard: z.boolean().optional().default(false),
});

const bulkScheduleSchema = z.object({
  posts: z.array(z.object({
    id: z.string().uuid(),
    scheduledAt: z.string().datetime(),
  })).min(1).max(100),
  timezone: z.string().optional().default('UTC'),
});

const bulkStatusUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(['draft', 'scheduled', 'archived']),
});

const bulkCreateSchema = z.object({
  posts: z.array(z.object({
    content: z.string().min(1).max(10000),
    campaignId: z.string().uuid(),
    scheduledAt: z.string().datetime().optional(),
    mediaUrls: z.array(z.string().url()).optional(),
    hashtags: z.array(z.string()).optional(),
  })).min(1).max(50),
});

// =============================================================================
// Auth Helper - Uses centralized JWT utilities (no fallback secrets)
// =============================================================================

import { verifyToken } from '@/lib/auth/jwt-utils';

async function getUserFromRequest(request: NextRequest): Promise<{ id: string; email: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);
    return { id: decoded.userId, email: decoded.email || '' };
  } catch {
    return null;
  }
}

// =============================================================================
// POST - Bulk Operations
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const operation = body.operation;

    switch (operation) {
      case 'delete': {
        const validation = bulkDeleteSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Validation Error', details: validation.error.issues },
            { status: 400 }
          );
        }

        const { ids, hard } = validation.data;

        // Verify ownership of all posts
        const posts = await prisma.post.findMany({
          where: { id: { in: ids } },
          include: { campaign: { select: { userId: true } } },
        });

        const unauthorized = posts.filter(
          (p) => p.campaign?.userId && p.campaign.userId !== user.id
        );

        if (unauthorized.length > 0) {
          return NextResponse.json(
            { error: 'Forbidden', message: 'You do not have access to some content items' },
            { status: 403 }
          );
        }

        if (hard) {
          await prisma.post.deleteMany({
            where: { id: { in: ids } },
          });
        } else {
          await prisma.post.updateMany({
            where: { id: { in: ids } },
            data: { status: 'archived', updatedAt: new Date() },
          });
        }

        return NextResponse.json({
          success: true,
          message: `${ids.length} items ${hard ? 'deleted' : 'archived'} successfully`,
          affected: ids.length,
        });
      }

      case 'schedule': {
        const validation = bulkScheduleSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Validation Error', details: validation.error.issues },
            { status: 400 }
          );
        }

        const { posts } = validation.data;
        const results = await Promise.all(
          posts.map(async (post) => {
            try {
              await prisma.post.update({
                where: { id: post.id },
                data: {
                  scheduledAt: new Date(post.scheduledAt),
                  status: 'scheduled',
                  updatedAt: new Date(),
                },
              });
              return { id: post.id, success: true };
            } catch (error) {
              return { id: post.id, success: false, error: 'Update failed' };
            }
          })
        );

        const successful = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;

        return NextResponse.json({
          success: true,
          message: `${successful} posts scheduled, ${failed} failed`,
          results,
        });
      }

      case 'status': {
        const validation = bulkStatusUpdateSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Validation Error', details: validation.error.issues },
            { status: 400 }
          );
        }

        const { ids, status } = validation.data;

        await prisma.post.updateMany({
          where: { id: { in: ids } },
          data: { status, updatedAt: new Date() },
        });

        return NextResponse.json({
          success: true,
          message: `${ids.length} items updated to ${status}`,
          affected: ids.length,
        });
      }

      case 'create': {
        const validation = bulkCreateSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Validation Error', details: validation.error.issues },
            { status: 400 }
          );
        }

        const { posts } = validation.data;

        // Verify user owns all campaigns
        const campaignIds = [...new Set(posts.map((p) => p.campaignId))];
        const campaigns = await prisma.campaign.findMany({
          where: { id: { in: campaignIds }, userId: user.id },
        });

        if (campaigns.length !== campaignIds.length) {
          return NextResponse.json(
            { error: 'Forbidden', message: 'You do not have access to some campaigns' },
            { status: 403 }
          );
        }

        // Get platform from campaigns for posts
        const campaignPlatforms = new Map(
          campaigns.map((c) => [c.id, c.platform])
        );

        const createdPosts = await prisma.post.createMany({
          data: posts.map((post) => ({
            content: post.content,
            campaignId: post.campaignId,
            platform: campaignPlatforms.get(post.campaignId) || 'unknown',
            scheduledAt: post.scheduledAt ? new Date(post.scheduledAt) : null,
            metadata: {
              mediaUrls: post.mediaUrls || [],
              hashtags: post.hashtags || [],
            },
            status: post.scheduledAt ? 'scheduled' : 'draft',
          })),
        });

        return NextResponse.json({
          success: true,
          message: `${createdPosts.count} posts created`,
          count: createdPosts.count,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Bad Request', message: 'Invalid operation. Use: delete, schedule, status, create' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Bulk operation error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
