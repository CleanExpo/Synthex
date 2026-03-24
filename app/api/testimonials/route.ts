/**
 * Testimonial Management
 *
 * GET   /api/testimonials?status=pending   — list submissions
 * PATCH /api/testimonials                  — not here, see [id] route
 *
 * UNI-1637
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 404 }
    );
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? undefined;
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = 20;

  const [items, total] = await Promise.all([
    prisma.testimonial.findMany({
      where: {
        organizationId,
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        submitterName: true,
        submitterEmail: true,
        rating: true,
        text: true,
        photoUrls: true,
        videoUrl: true,
        status: true,
        gbpPostId: true,
        postedToGmbAt: true,
        createdAt: true,
        request: { select: { title: true } },
      },
    }),
    prisma.testimonial.count({
      where: { organizationId, ...(status && { status }) },
    }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
