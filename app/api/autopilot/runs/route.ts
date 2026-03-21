/**
 * Autopilot Runs API
 *
 * GET /api/autopilot/runs — List autopilot runs (paginated)
 *
 * @module app/api/autopilot/runs/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';

export async function GET(request: NextRequest) {
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

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get('limit') ?? '20'))
  );
  const skip = (page - 1) * limit;

  const [runs, total] = await Promise.all([
    prisma.autopilotRun.findMany({
      where: { organizationId },
      orderBy: { startedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.autopilotRun.count({ where: { organizationId } }),
  ]);

  return NextResponse.json({
    runs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
