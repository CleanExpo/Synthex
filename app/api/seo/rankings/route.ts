/**
 * GET /api/seo/rankings
 *
 * Lists all active KeywordTarget records for the org, each with
 * its latest KeywordRankSnapshot.
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

  const targets = await prisma.keywordTarget.findMany({
    where: { organizationId, isActive: true },
    include: {
      snapshots: {
        orderBy: { snapshotDate: 'desc' },
        take: 8, // 8 weeks for sparkline
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ success: true, targets });
}
