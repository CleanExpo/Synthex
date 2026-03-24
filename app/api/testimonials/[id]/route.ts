/**
 * Single Testimonial — Status Update
 *
 * PATCH /api/testimonials/[id]
 *   body: { status: "approved" | "rejected" }
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

const PatchSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 404 }
    );
  }

  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Org-scope check
  const existing = await prisma.testimonial.findFirst({
    where: { id, organizationId },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updated = await prisma.testimonial.update({
    where: { id },
    data: { status: parsed.data.status },
    select: { id: true, status: true, updatedAt: true },
  });

  return NextResponse.json(updated);
}
