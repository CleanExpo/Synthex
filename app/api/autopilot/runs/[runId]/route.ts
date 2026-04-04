/**
 * Autopilot Run Detail API
 *
 * GET /api/autopilot/runs/[runId] — Get a single run with post references
 *
 * @module app/api/autopilot/runs/[runId]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  const { runId } = await params;

  const run = await prisma.autopilotRun.findFirst({
    where: { id: runId, organizationId },
  });

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  // Fetch associated posts if any
  let posts: Array<{
    id: string;
    content: string;
    platform: string;
    status: string;
    scheduledAt: Date | null;
  }> = [];
  if (run.postIds.length > 0) {
    posts = await prisma.post.findMany({
      where: { id: { in: run.postIds } },
      select: {
        id: true,
        content: true,
        platform: true,
        status: true,
        scheduledAt: true,
      },
      take: 500,
    });
  }

  return NextResponse.json({ run, posts });
}
