/**
 * Auto-Research API
 * GET  /api/auto-research  — list recent runs (global + org-scoped)
 * POST /api/auto-research  — trigger a manual research run
 *
 * ENVIRONMENT VARIABLES:
 * - REDIS_URL: Required for POST (BullMQ enqueueing)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import {
  getEffectiveOrganizationId,
  resolveCampaignOrganizationId,
  OrgAccessError,
} from '@/lib/multi-business/business-scope';
import { enqueueManualRun } from '@/lib/auto-research';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const triggerSchema = z.object({
  type: z.enum(['daily_trends', 'weekly_deep']).default('daily_trends'),
  orgId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const orgId = await getEffectiveOrganizationId(userId);

  try {
    const runs = await prisma.autoResearchRun.findMany({
      where: {
        OR: [
          { organizationId: null }, // global runs
          ...(orgId ? [{ organizationId: orgId }] : []),
        ],
      },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        runType: true,
        status: true,
        platforms: true,
        insightsCount: true,
        promptsUpdated: true,
        startedAt: true,
        completedAt: true,
        error: true,
        organizationId: true,
      },
    });

    return NextResponse.json({ runs });
  } catch (err) {
    logger.error('auto-research GET failed', { error: err });
    return NextResponse.json(
      { error: 'Failed to fetch research runs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = triggerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { type, orgId: requestedOrgId } = parsed.data;

  // Resolve the target org. When the client passes an explicit orgId, verify the
  // user actually has access to it before scoping the run — otherwise a member of
  // org A could trigger a research run (and persist TrendInsights + incur Apify/AI
  // spend) against org B by passing its id. When omitted, fall back to the user's
  // effective (active) organisation, preserving the no-org global-run behaviour.
  let effectiveOrgId: string | undefined;
  try {
    effectiveOrgId =
      (await resolveCampaignOrganizationId(userId, requestedOrgId)) ??
      undefined;
  } catch (err) {
    if (err instanceof OrgAccessError) {
      return NextResponse.json(
        { error: 'Forbidden — no access to requested organisation' },
        { status: 403 }
      );
    }
    logger.error('auto-research POST org resolution failed', { error: err });
    return NextResponse.json(
      { error: 'Failed to resolve organisation context' },
      { status: 500 }
    );
  }

  try {
    const jobId = await enqueueManualRun(type, effectiveOrgId);
    return NextResponse.json(
      { jobId, type, status: 'queued' },
      { status: 202 }
    );
  } catch (err) {
    logger.error('auto-research POST failed', { error: err });
    return NextResponse.json(
      { error: 'Failed to enqueue research run' },
      { status: 500 }
    );
  }
}
