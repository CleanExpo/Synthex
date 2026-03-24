/**
 * Public Reviews Embed API
 *
 * GET /api/public/reviews/[orgSlug]
 *
 * No authentication required — this endpoint is called by the embed
 * snippet on the client's own website.
 *
 * Query params:
 *   min_rating  — minimum star rating to include (default: 4)
 *   limit       — max reviews to return (default: 6, max: 20)
 *
 * CORS: responds with Access-Control-Allow-Origin: * so any website
 * can fetch it.
 *
 * UNI-1638
 */

import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
// Reviews are refreshed daily by the cron — 1h cache is safe
export const revalidate = 3600;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;

  const url = new URL(request.url);
  const minRating = Math.min(
    5,
    Math.max(1, parseInt(url.searchParams.get('min_rating') ?? '4', 10))
  );
  const limit = Math.min(
    20,
    Math.max(1, parseInt(url.searchParams.get('limit') ?? '6', 10))
  );

  // Resolve org by slug
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true },
  });

  if (!org) {
    return NextResponse.json(
      { error: 'Organisation not found' },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  const reviews = await prisma.gBPReview.findMany({
    where: {
      organizationId: org.id,
      rating: { gte: minRating },
      comment: { not: null },
    },
    orderBy: [{ rating: 'desc' }, { reviewTime: 'desc' }],
    take: limit,
    select: {
      id: true,
      reviewerName: true,
      reviewerAvatar: true,
      rating: true,
      comment: true,
      reviewTime: true,
    },
  });

  const avgRating =
    reviews.length > 0
      ? Math.round(
          (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10
        ) / 10
      : null;

  return NextResponse.json(
    {
      businessName: org.name,
      averageRating: avgRating,
      totalShown: reviews.length,
      reviews: reviews.map(r => ({
        id: r.id,
        reviewerName: r.reviewerName ?? 'A Google user',
        reviewerAvatar: r.reviewerAvatar ?? null,
        rating: r.rating,
        comment: r.comment,
        reviewTime: r.reviewTime.toISOString(),
      })),
    },
    { headers: CORS_HEADERS }
  );
}
