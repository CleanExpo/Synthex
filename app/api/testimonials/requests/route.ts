/**
 * Testimonial Request Management
 *
 * POST /api/testimonials/requests — create a new collection link
 * GET  /api/testimonials/requests — list all requests for the org
 *
 * UNI-1637
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const CreateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  subtitle: z.string().max(240).optional(),
  expiresAt: z.string().datetime().optional(),
});

// ---------------------------------------------------------------------------
// POST — Create a new testimonial request link
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { title, subtitle, expiresAt } = parsed.data;

  const req = await prisma.testimonialRequest.create({
    data: {
      organizationId,
      ...(title && { title }),
      ...(subtitle && { subtitle }),
      ...(expiresAt && { expiresAt: new Date(expiresAt) }),
    },
    select: {
      id: true,
      token: true,
      title: true,
      subtitle: true,
      isActive: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

  return NextResponse.json(
    { ...req, url: `${appUrl}/testimonial/${req.token}` },
    { status: 201 }
  );
}

// ---------------------------------------------------------------------------
// GET — List all requests for the org
// ---------------------------------------------------------------------------

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

  const requests = await prisma.testimonialRequest.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      token: true,
      title: true,
      isActive: true,
      expiresAt: true,
      createdAt: true,
      _count: { select: { testimonials: true } },
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

  return NextResponse.json(
    requests.map(r => ({
      ...r,
      url: `${appUrl}/testimonial/${r.token}`,
      submissionCount: r._count.testimonials,
    }))
  );
}
