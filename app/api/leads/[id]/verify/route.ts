/**
 * POST /api/leads/[id]/verify — Human-gated revenue verification
 *
 * An authorised user (must belong to the Lead's organisation) records the
 * verified revenue that can be attributed to this lead. If the caller does
 * not explicitly pass a `stage` and `verifiedRevenueAud > 0`, the lead is
 * transitioned to `converted`.
 *
 * Auth:
 *   - 401 when unauthenticated
 *   - 403 when the user does not belong to the lead's organisation
 *   - 404 when the lead does not exist
 *   - 400 when the body is invalid
 *
 * @task SYN-794
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

const StageEnum = z.enum(['enquiry', 'qualified', 'converted']);

const BodySchema = z.object({
  verifiedRevenueAud: z.coerce.number().nonnegative(),
  stage: StageEnum.optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
      { error: 'No organisation found for user' },
      { status: 403 }
    );
  }

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, organizationId: true, stage: true },
  });
  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  if (lead.organizationId !== user.organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { verifiedRevenueAud, stage } = parsed.data;

  // Default stage transition: if verified revenue is positive and the caller
  // did not explicitly specify a stage, treat this as a conversion.
  const resolvedStage =
    stage ?? (verifiedRevenueAud > 0 ? 'converted' : lead.stage);

  try {
    const updated = await prisma.lead.update({
      where: { id },
      data: {
        verifiedRevenueAud,
        verifiedAt: new Date(),
        verifiedByUserId: userId,
        stage: resolvedStage,
      },
      select: {
        id: true,
        stage: true,
        verifiedAt: true,
        verifiedByUserId: true,
        verifiedRevenueAud: true,
      },
    });

    return NextResponse.json({ ok: true, lead: updated }, { status: 200 });
  } catch (err) {
    logger.error('[leads/verify] update failed', {
      leadId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to verify lead' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
