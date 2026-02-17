/**
 * Competitor Tracking API Route
 *
 * @description Manage tracked competitors:
 * - GET: List tracked competitors
 * - POST: Add a new tracked competitor
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

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Tracked competitor where clause */
interface CompetitorWhereClause {
  userId: string;
  isActive?: boolean;
  industry?: string;
  domain?: string;
}

/** Tracked competitor record */
interface TrackedCompetitorRecord {
  id: string;
  userId: string;
  name: string;
  domain?: string | null;
  _count?: {
    snapshots?: number;
    posts?: number;
    alerts?: number;
  };
  createdAt: Date;
}

/** Extended Prisma client with competitor models */
interface ExtendedPrismaClient {
  trackedCompetitor?: {
    findFirst: (args: { where: Record<string, unknown> }) => Promise<TrackedCompetitorRecord | null>;
    findMany: (args: { where: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; skip?: number; include?: Record<string, unknown> }) => Promise<TrackedCompetitorRecord[]>;
    create: (args: { data: Record<string, unknown> }) => Promise<TrackedCompetitorRecord>;
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
  };
  competitorSnapshot?: {
    findFirst: (args: { where: Record<string, unknown>; orderBy?: Record<string, string> }) => Promise<unknown>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

/** Get prisma with extended models */
const extendedPrisma = prisma as unknown as typeof prisma & ExtendedPrismaClient;

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const addCompetitorSchema = z.object({
  name: z.string().min(1).max(200),
  domain: z.string().url().optional().nullable(),
  description: z.string().max(2000).optional(),
  industry: z.string().max(100).optional(),
  twitterHandle: z.string().max(50).optional(),
  instagramHandle: z.string().max(50).optional(),
  linkedinHandle: z.string().max(100).optional(),
  facebookHandle: z.string().max(100).optional(),
  youtubeHandle: z.string().max(100).optional(),
  tiktokHandle: z.string().max(50).optional(),
  trackingFrequency: z.enum(['hourly', 'daily', 'weekly']).default('daily'),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().max(5000).optional(),
});

// ============================================================================
// GET /api/competitors/track
// List tracked competitors
// ============================================================================

export async function GET(request: NextRequest) {
  try {
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
    const { searchParams } = new URL(request.url);

    const isActive = searchParams.get('active');
    const industry = searchParams.get('industry');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    const where: CompetitorWhereClause = { userId };
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }
    if (industry) {
      where.industry = industry;
    }

    const [competitors, total] = await Promise.all([
      extendedPrisma.trackedCompetitor?.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: {
              snapshots: true,
              posts: true,
              alerts: { where: { isRead: false } },
            },
          },
        },
      }) || [],
      extendedPrisma.trackedCompetitor?.count({ where }) || 0,
    ]);

    // Get latest snapshot for each competitor
    const competitorsWithLatestSnapshot = await Promise.all(
      (competitors || []).map(async (comp: TrackedCompetitorRecord) => {
        const latestSnapshot = await extendedPrisma.competitorSnapshot?.findFirst({
          where: { competitorId: comp.id, platform: 'all' },
          orderBy: { snapshotAt: 'desc' },
        });

        return {
          ...comp,
          latestSnapshot,
          unreadAlerts: comp._count?.alerts || 0,
        };
      })
    );

    return NextResponse.json({
      competitors: competitorsWithLatestSnapshot,
      total,
      hasMore: (competitors?.length || 0) === limit,
    });
  } catch (error) {
    console.error('List competitors error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch competitors' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/competitors/track
// Add a tracked competitor
// ============================================================================

export async function POST(request: NextRequest) {
  try {
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
    const validation = addCompetitorSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Normalize domain
    let normalizedDomain = data.domain;
    if (normalizedDomain) {
      try {
        const url = new URL(normalizedDomain);
        normalizedDomain = url.hostname.replace(/^www\./, '');
      } catch {
        normalizedDomain = normalizedDomain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      }
    }

    // Check for existing competitor with same domain
    if (normalizedDomain) {
      const existing = await extendedPrisma.trackedCompetitor?.findFirst({
        where: { userId, domain: normalizedDomain },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'Competitor with this domain already exists', existingId: existing.id },
          { status: 409 }
        );
      }
    }

    // Create competitor
    const competitor = await extendedPrisma.trackedCompetitor?.create({
      data: {
        userId,
        name: data.name,
        domain: normalizedDomain,
        description: data.description,
        industry: data.industry,
        twitterHandle: data.twitterHandle,
        instagramHandle: data.instagramHandle,
        linkedinHandle: data.linkedinHandle,
        facebookHandle: data.facebookHandle,
        youtubeHandle: data.youtubeHandle,
        tiktokHandle: data.tiktokHandle,
        trackingFrequency: data.trackingFrequency,
        tags: data.tags,
        notes: data.notes,
      },
    });

    // Create initial snapshot placeholder -- cron will populate real data on next cycle
    try {
      await extendedPrisma.competitorSnapshot?.create({
        data: {
          competitorId: competitor.id,
          platform: 'all',
          dataSource: 'initial',
        },
      });
    } catch (snapshotError) {
      console.error('Failed to create initial snapshot:', snapshotError);
      // Don't block competitor creation response -- cron will create snapshots on next cycle
    }

    return NextResponse.json({
      competitor,
      message: 'Competitor added successfully. Tracking will begin shortly.',
    }, { status: 201 });
  } catch (error) {
    console.error('Add competitor error:', error);
    return NextResponse.json(
      { error: 'Failed to add competitor' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
