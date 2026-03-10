/**
 * Individual Competitor Tracking API Route
 *
 * @description Manage individual tracked competitor:
 * - GET: Get competitor details with latest data
 * - PATCH: Update competitor settings
 * - DELETE: Remove competitor from tracking
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 *
 * FAILURE MODE: Returns 500 on database errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Competitor snapshot record */
interface CompetitorSnapshot {
  platform: string;
  snapshotAt: Date;
  followersCount?: number | null;
  engagementRate?: number | null;
  performanceScore?: number | null;
}

/** Extended Prisma client with competitor models */
interface ExtendedPrismaClient {
  trackedCompetitor?: {
    findFirst: (args: { where: Record<string, unknown>; include?: Record<string, unknown> }) => Promise<CompetitorDetailRecord | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<CompetitorDetailRecord>;
    delete: (args: { where: { id: string } }) => Promise<void>;
  };
  competitorPost?: {
    findMany: (args: { where: Record<string, unknown>; orderBy?: Record<string, string>; take?: number }) => Promise<unknown[]>;
  };
}

/** Competitor detail record */
interface CompetitorDetailRecord {
  id: string;
  userId: string;
  name: string;
  snapshots: CompetitorSnapshot[];
  posts: unknown[];
  alerts: unknown[];
}

/** Get prisma with extended models */
const extendedPrisma = prisma as unknown as typeof prisma & ExtendedPrismaClient;

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const updateCompetitorSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  industry: z.string().max(100).optional(),
  twitterHandle: z.string().max(50).optional().nullable(),
  instagramHandle: z.string().max(50).optional().nullable(),
  linkedinHandle: z.string().max(100).optional().nullable(),
  facebookHandle: z.string().max(100).optional().nullable(),
  youtubeHandle: z.string().max(100).optional().nullable(),
  tiktokHandle: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
  trackPosts: z.boolean().optional(),
  trackMetrics: z.boolean().optional(),
  trackingFrequency: z.enum(['hourly', 'daily', 'weekly']).optional(),
  alertsEnabled: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(5000).optional().nullable(),
});

// ============================================================================
// GET /api/competitors/track/[id]
// Get competitor details
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_READ
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const userId = security.context.userId!;

    // Fetch competitor with related data
    const competitor = await extendedPrisma.trackedCompetitor?.findFirst({
      where: { id, userId },
      include: {
        snapshots: {
          orderBy: { snapshotAt: 'desc' },
          take: 30,
        },
        posts: {
          orderBy: { postedAt: 'desc' },
          take: 20,
        },
        alerts: {
          where: { isRead: false },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!competitor) {
      return NextResponse.json(
        { error: 'Competitor not found' },
        { status: 404 }
      );
    }

    // Calculate trends from snapshots
    const recentSnapshots = competitor.snapshots.filter(
      (s: CompetitorSnapshot) => s.platform === 'all'
    );

    let trends = null;
    if (recentSnapshots.length >= 2) {
      const latest = recentSnapshots[0];
      const previous = recentSnapshots[1];

      trends = {
        followersChange: latest.followersCount && previous.followersCount
          ? latest.followersCount - previous.followersCount
          : null,
        engagementChange: latest.engagementRate && previous.engagementRate
          ? Math.round((latest.engagementRate - previous.engagementRate) * 100) / 100
          : null,
        performanceChange: latest.performanceScore && previous.performanceScore
          ? Math.round((latest.performanceScore - previous.performanceScore) * 10) / 10
          : null,
      };
    }

    // Get top performing posts
    const topPosts = await extendedPrisma.competitorPost?.findMany({
      where: { competitorId: id, isTopPerforming: true },
      orderBy: { engagementRate: 'desc' },
      take: 5,
    }) || [];

    return NextResponse.json({
      competitor: {
        ...competitor,
        trends,
        topPosts,
      },
    });
  } catch (error) {
    logger.error('Get competitor error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch competitor' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/competitors/track/[id]
// Update competitor settings
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const userId = security.context.userId!;
    const body = await request.json();

    // Validate input
    const validation = updateCompetitorSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Check competitor exists and belongs to user
    const existing = await extendedPrisma.trackedCompetitor?.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Competitor not found' },
        { status: 404 }
      );
    }

    // Update competitor
    const competitor = await extendedPrisma.trackedCompetitor?.update({
      where: { id },
      data: {
        ...validation.data,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      competitor,
      message: 'Competitor updated successfully',
    });
  } catch (error) {
    logger.error('Update competitor error:', error);
    return NextResponse.json(
      { error: 'Failed to update competitor' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/competitors/track/[id]
// Remove competitor from tracking
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const userId = security.context.userId!;

    // Check competitor exists and belongs to user
    const existing = await extendedPrisma.trackedCompetitor?.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Competitor not found' },
        { status: 404 }
      );
    }

    // Delete competitor (cascades to snapshots, posts, alerts)
    await extendedPrisma.trackedCompetitor?.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Competitor removed from tracking',
      deletedId: id,
    });
  } catch (error) {
    logger.error('Delete competitor error:', error);
    return NextResponse.json(
      { error: 'Failed to delete competitor' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
