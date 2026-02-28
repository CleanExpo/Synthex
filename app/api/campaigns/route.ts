/**
 * Campaigns API Route
 * CRUD operations for marketing campaigns
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { z } from 'zod';

// Validation schemas
const campaignCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  platform: z.enum(['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'threads', 'multi']),
  content: z.string().max(10000, 'Content too long').optional(),
  settings: z.object({
    hashtags: z.array(z.string()).optional(),
    mentions: z.array(z.string()).optional(),
    scheduledAt: z.string().datetime().optional(),
    targetAudience: z.string().optional(),
  }).passthrough().optional(),
});

const campaignUpdateSchema = z.object({
  id: z.string().uuid('Invalid campaign ID'),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  platform: z.enum(['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'threads', 'multi']).optional(),
  content: z.string().max(10000).optional(),
  settings: z.object({
    hashtags: z.array(z.string()).optional(),
    mentions: z.array(z.string()).optional(),
    scheduledAt: z.string().datetime().optional(),
    targetAudience: z.string().optional(),
  }).passthrough().optional(),
  status: z.enum(['draft', 'scheduled', 'active', 'paused', 'completed', 'archived']).optional(),
}).strict();

// GET /api/campaigns - Get all campaigns for user
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      include: {
        posts: {
          select: {
            id: true,
            status: true,
            platform: true,
            scheduledAt: true,
            publishedAt: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ campaigns });
  } catch (error: unknown) {
    console.error('Get campaigns error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

// POST /api/campaigns - Create new campaign
export async function POST(request: NextRequest) {
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
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { name, description, platform, content, settings } = validationResult.data;

    const campaign = await prisma.$transaction(async (tx) => {
      const created = await tx.campaign.create({
        data: {
          name,
          description,
          platform,
          content,
          settings: settings as object | undefined,
          userId,
          status: 'draft',
        }
      });

      // Log campaign creation within the same transaction
      await tx.auditLog.create({
        data: {
          action: 'campaign_created',
          resource: 'campaign',
          resourceId: created.id,
          category: 'data',
          outcome: 'success',
          userId,
          details: { campaignName: name, platform }
        }
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      campaign
    });
  } catch (error: unknown) {
    console.error('Create campaign error:', error);
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    );
  }
}

// PUT /api/campaigns - Update campaign
export async function PUT(request: NextRequest) {
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
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { id, settings, ...restUpdateData } = validationResult.data;

    // Verify ownership
    const existingCampaign = await prisma.campaign.findFirst({
      where: { id, userId }
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
        ...(settings !== undefined && { settings: settings as object })
      }
    });

    return NextResponse.json({
      success: true,
      campaign
    });
  } catch (error: unknown) {
    console.error('Update campaign error:', error);
    return NextResponse.json(
      { error: 'Failed to update campaign' },
      { status: 500 }
    );
  }
}

// DELETE /api/campaigns - Delete campaign
export async function DELETE(request: NextRequest) {
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
      where: { id, userId }
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.campaign.delete({
        where: { id }
      });

      // Log deletion within the same transaction
      await tx.auditLog.create({
        data: {
          action: 'campaign_deleted',
          resource: 'campaign',
          resourceId: id,
          category: 'data',
          outcome: 'success',
          userId,
          details: { campaignName: campaign.name }
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error: unknown) {
    console.error('Delete campaign error:', error);
    return NextResponse.json(
      { error: 'Failed to delete campaign' },
      { status: 500 }
    );
  }
}
// Node.js runtime required for Prisma
export const runtime = 'nodejs';
