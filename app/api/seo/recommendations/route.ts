/**
 * GET /api/seo/recommendations
 * Returns top 3 unused ContentTopicSuggestion records for the org,
 * ordered by opportunityScore DESC.
 *
 * SYN-482
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import prisma from '@/lib/prisma';

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

  const recommendations = await prisma.contentTopicSuggestion.findMany({
    where: { organizationId, usedAt: null },
    orderBy: { opportunityScore: 'desc' },
    take: 3,
    select: {
      id: true,
      keyword: true,
      impressions: true,
      currentRank: true,
      opportunityScore: true,
    },
  });

  return NextResponse.json({ recommendations });
}
