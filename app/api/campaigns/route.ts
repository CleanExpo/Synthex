/**
 * Campaigns API Route
 * CRUD operations for marketing campaigns
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

// JWT Secret - CRITICAL: Never use fallback
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

const JWT_SECRET = getJWTSecret();

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

// Helper to get user from token
async function getUserFromRequest(request: Request) {
  const cookieStore = cookies();
  const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                cookieStore.get('session')?.value;

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
  } catch {
    return null;
  }
}

// GET /api/campaigns - Get all campaigns for user
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const campaigns = await prisma.campaign.findMany({
      where: { userId: user.id },
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
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    const campaign = await prisma.campaign.create({
      data: {
        name,
        description,
        platform,
        content,
        settings: settings as object | undefined,
        userId: user.id,
        status: 'draft',
      }
    });

    // Log campaign creation
    await prisma.auditLog.create({
      data: {
        action: 'campaign_created',
        resource: 'campaign',
        resourceId: campaign.id,
        category: 'data',
        outcome: 'success',
        userId: user.id,
        details: { campaignName: name, platform }
      }
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
export async function PUT(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
      where: { id, userId: user.id }
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
export async function DELETE(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
      where: { id, userId: user.id }
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    await prisma.campaign.delete({
      where: { id }
    });

    // Log deletion
    await prisma.auditLog.create({
      data: {
        action: 'campaign_deleted',
        resource: 'campaign',
        resourceId: id,
        category: 'data',
        outcome: 'success',
        userId: user.id,
        details: { campaignName: campaign.name }
      }
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
