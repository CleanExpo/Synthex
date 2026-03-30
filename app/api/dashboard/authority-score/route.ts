/**
 * Authority Score API
 *
 * GET /api/dashboard/authority-score
 *
 * Computes (or returns a cached) Synthex Authority Score for the
 * authenticated user's organisation.
 *
 * Flow:
 *  1. Auth → org ID
 *  2. Check authority_scores for a record computed within the last 24h
 *  3. If fresh → return cached score
 *  4. If stale / missing → fetch signals → computeAuthorityScore → upsert → return
 *
 * Query param: ?force=true  — skip cache and recompute
 *
 * @task SYN-513
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { computeAuthorityScore } from '@/lib/scoring/computeAuthorityScore';
import { logger } from '@/lib/logger';

// ── Constants ─────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const THIRTY_DAYS_AGO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
};

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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
    const organizationId = user.organizationId;

    // ── Cache check ─────────────────────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    if (!force) {
      try {
        const cached = await prisma.authorityScore.findFirst({
          where: {
            organizationId,
            computedAt: { gte: new Date(Date.now() - CACHE_TTL_MS) },
          },
          orderBy: { computedAt: 'desc' },
          select: {
            score: true,
            eeAtBreakdown: true,
            signalsVersion: true,
            computedAt: true,
          },
        });

        if (cached) {
          return NextResponse.json(
            {
              success: true,
              data: {
                score: cached.score,
                breakdown: cached.eeAtBreakdown,
                signalsVersion: cached.signalsVersion,
                computedAt: cached.computedAt.toISOString(),
                fromCache: true,
              },
            },
            {
              headers: {
                'Cache-Control':
                  'private, max-age=3600, stale-while-revalidate=1800',
              },
            }
          );
        }
      } catch (cacheErr) {
        // Table may not exist yet (pre-migration) — fall through to compute
        logger.warn(
          'authority-score: cache lookup failed (table may not exist)',
          {
            error: cacheErr,
          }
        );
      }
    }

    // ── Fetch signals ───────────────────────────────────────────────────────
    const thirtyDaysAgo = THIRTY_DAYS_AGO();

    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

    const [
      org,
      recentReviews,
      totalReviewAgg,
      recentPosts,
      brandDna,
      reviewResponseAgg,
    ] = await Promise.all([
      // GBP location signals
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          gbpLocations: {
            where: { isPrimary: true },
            take: 1,
            select: {
              phone: true,
              address: true,
              hours: true,
              categories: true,
              verified: true,
            },
          },
        },
      }),
      // Review velocity (last 30 days)
      prisma.gBPReview.count({
        where: {
          organizationId,
          status: 'approved',
          reviewTime: { gte: thirtyDaysAgo },
        },
      }),
      // Average review score aggregate
      prisma.gBPReview.aggregate({
        where: { organizationId, status: 'approved' },
        _count: { id: true },
        _avg: { rating: true },
      }),
      // Content freshness
      prisma.post.count({
        where: {
          campaign: { organizationId },
          status: 'published',
          publishedAt: { gte: thirtyDaysAgo },
        },
      }),
      // Brand DNA / schema coverage
      prisma.brandDNA.findUnique({
        where: { organizationId },
        select: {
          brandVoice: true,
          industry: true,
        },
      }),
      // Review response rate — SYN-532 (last 90 days)
      prisma.gBPReview.groupBy({
        by: ['responseStatus'],
        where: {
          organizationId,
          status: 'approved',
          reviewTime: { gte: ninetyDaysAgo },
        },
        _count: { id: true },
      }),
    ]);

    const location = org?.gbpLocations[0] ?? null;
    const brandVoice = brandDna?.brandVoice as
      | { tone?: string }
      | null
      | undefined;

    // Compute response rate from grouped counts (SYN-532)
    const totalRecent90 = reviewResponseAgg.reduce(
      (sum, r) => sum + r._count.id,
      0
    );
    const postedRecent90 =
      reviewResponseAgg.find(r => r.responseStatus === 'posted')?._count.id ??
      0;
    const reviewResponseRate =
      totalRecent90 > 0 ? postedRecent90 / totalRecent90 : 0;

    // ── Compute ─────────────────────────────────────────────────────────────
    const result = computeAuthorityScore({
      gbpLocationCount: location ? 1 : 0,
      gbpHasPhone: Boolean(location?.phone),
      gbpHasAddress: Boolean(location?.address),
      gbpHasHours: Boolean(location?.hours),
      gbpHasCategories: Boolean(location?.categories),
      gbpIsVerified: location?.verified ?? false,
      recentReviewCount: recentReviews,
      publishedPostsLast30Days: recentPosts,
      hasBrandDna: brandDna !== null,
      brandDnaHasTone: Boolean(brandVoice?.tone),
      brandDnaHasIndustry: Boolean(brandDna?.industry),
      reviewResponseRate,
      totalReviewCount: totalReviewAgg._count.id,
      averageRating: totalReviewAgg._avg.rating ?? 0,
    });

    // ── Persist (non-fatal) ─────────────────────────────────────────────────
    const now = new Date();
    try {
      await prisma.authorityScore.create({
        data: {
          organizationId,
          score: result.score,
          eeAtBreakdown: result.breakdown as unknown as Record<string, number>,
          signalsVersion: result.signalsVersion,
          computedAt: now,
        },
      });
    } catch (persistErr) {
      // Non-fatal: table may not exist yet pending migration
      logger.warn('authority-score: persist failed (table may not exist)', {
        error: persistErr,
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          score: result.score,
          breakdown: result.breakdown,
          signalsVersion: result.signalsVersion,
          computedAt: now.toISOString(),
          fromCache: false,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=3600, stale-while-revalidate=1800',
        },
      }
    );
  } catch (error) {
    logger.error('authority-score: unexpected error', { error });
    return NextResponse.json(
      { error: 'Failed to compute authority score' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
