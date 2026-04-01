/**
 * GET  /api/advisor/brief  — Fetch the latest delivered advisor brief for this org
 * PATCH /api/advisor/brief  — Mark an action as done
 *
 * @task SYN-595
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

const PatchSchema = z.object({
  actionIndex: z.number().int().min(0).max(2),
});

async function resolveOrg(
  request: NextRequest
): Promise<{ organizationId: string } | NextResponse> {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
  }

  return { organizationId: user.organizationId };
}

export async function GET(request: NextRequest) {
  const orgResult = await resolveOrg(request);
  if (orgResult instanceof NextResponse) return orgResult;
  const { organizationId } = orgResult;

  const brief = await prisma.recommendedAction.findFirst({
    where: { organizationId, status: 'delivered' },
    orderBy: { weekStart: 'desc' },
  });

  if (!brief) {
    return NextResponse.json({ brief: null });
  }

  return NextResponse.json({ brief });
}

export async function PATCH(request: NextRequest) {
  const orgResult = await resolveOrg(request);
  if (orgResult instanceof NextResponse) return orgResult;
  const { organizationId } = orgResult;

  const body = await request.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { actionIndex } = parsed.data;

  // Fetch the latest delivered brief for this org
  const brief = await prisma.recommendedAction.findFirst({
    where: { organizationId, status: 'delivered' },
    orderBy: { weekStart: 'desc' },
  });

  if (!brief) {
    return NextResponse.json({ error: 'No brief found' }, { status: 404 });
  }

  const actions = brief.actions as Array<Record<string, unknown>>;
  if (!Array.isArray(actions) || actionIndex >= actions.length) {
    return NextResponse.json({ error: 'Invalid action index' }, { status: 400 });
  }

  // Mutate the action in JS, then persist the full JSON
  const updated = actions.map((action, i) =>
    i === actionIndex
      ? { ...action, completed_at: new Date().toISOString() }
      : action
  );

  const result = await prisma.recommendedAction.update({
    where: { id: brief.id },
    data: { actions: updated as unknown as Prisma.InputJsonValue },
  });

  logger.info('advisor/brief: action marked done', {
    orgId: organizationId,
    briefId: brief.id,
    actionIndex,
  });

  return NextResponse.json({ brief: result });
}
