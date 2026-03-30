/**
 * GET /api/reviews/google
 *
 * Returns the top Google Business Profile reviews (≥ 4 stars, approved,
 * displayOnWidget = true) for a given organisation.
 *
 * Query params:
 *   orgId  — organisation ID (public — used on landing page)
 *   limit  — max reviews to return (default 5, max 10)
 *
 * Caching: Upstash Redis, 1-hour TTL per orgId.
 * Falls back gracefully when Redis is unavailable.
 *
 * @task UNI-1642
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ── Cache helpers ─────────────────────────────────────────────────────────────

const CACHE_TTL_SECONDS = 3600; // 1 hour

async function getCached(key: string): Promise<unknown | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 }, // bypass Next.js fetch cache
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string | null };
    return json.result ? (JSON.parse(json.result) as unknown) : null;
  } catch {
    return null;
  }
}

async function setCache(key: string, value: unknown): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;

  try {
    await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        value: JSON.stringify(value),
        ex: CACHE_TTL_SECONDS,
      }),
    });
  } catch {
    // Cache write failures are non-fatal
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export interface GoogleReviewSummary {
  id: string;
  reviewerName: string;
  reviewerAvatar: string | null;
  rating: number;
  comment: string | null;
  reviewTime: string;
  isFeatured: boolean;
}

export interface GoogleReviewsResponse {
  reviews: GoogleReviewSummary[];
  totalCount: number;
  averageRating: number;
  locationName: string | null;
  newReviewUri: string | null;
  cached: boolean;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId');
  const limit = Math.min(Number(searchParams.get('limit') ?? '5'), 10);

  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  const cacheKey = `gbp-reviews:${orgId}:${limit}`;

  // ── Cache hit ───────────────────────────────────────────────────────────────
  const cached = await getCached(cacheKey);
  if (cached) {
    return NextResponse.json({ ...(cached as object), cached: true });
  }

  // ── DB query ────────────────────────────────────────────────────────────────
  try {
    const [reviews, allReviews, location] = await Promise.all([
      prisma.gBPReview.findMany({
        where: {
          organizationId: orgId,
          rating: { gte: 4 },
          status: 'approved',
          displayOnWidget: true,
        },
        orderBy: [
          { isFeatured: 'desc' },
          { widgetOrder: 'asc' },
          { reviewTime: 'desc' },
        ],
        take: limit,
        select: {
          id: true,
          reviewerName: true,
          reviewerAvatar: true,
          rating: true,
          comment: true,
          reviewTime: true,
          isFeatured: true,
        },
      }),

      // Aggregate for average rating
      prisma.gBPReview.aggregate({
        where: {
          organizationId: orgId,
          status: 'approved',
          displayOnWidget: true,
        },
        _avg: { rating: true },
        _count: { id: true },
      }),

      // Primary location for review link
      prisma.gBPLocation.findFirst({
        where: { organizationId: orgId, isPrimary: true },
        select: { locationName: true, newReviewUri: true },
      }),
    ]);

    const response: GoogleReviewsResponse = {
      reviews: reviews.map(r => ({
        id: r.id,
        reviewerName: r.reviewerName ?? 'Anonymous',
        reviewerAvatar: r.reviewerAvatar,
        rating: r.rating,
        comment: r.comment,
        reviewTime: r.reviewTime.toISOString(),
        isFeatured: r.isFeatured,
      })),
      totalCount: allReviews._count.id,
      averageRating: allReviews._avg.rating ?? 0,
      locationName: location?.locationName ?? null,
      newReviewUri: location?.newReviewUri ?? null,
      cached: false,
    };

    // Cache the result
    await setCache(cacheKey, response);

    return NextResponse.json(response);
  } catch (err) {
    logger.error('GET /api/reviews/google failed', { error: err, orgId });
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}
