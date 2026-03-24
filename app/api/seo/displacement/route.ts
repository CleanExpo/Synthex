/**
 * GET /api/seo/displacement
 * Returns top displacement opportunities for the authenticated org.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { getDisplacementOpportunities } from '@/lib/seo/competitor-displacement';
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

  // Get competitors for this org via their keyword gaps (competitors are user-scoped,
  // but we surface the ones associated with this org's gap data)
  const [opportunities, gapCompetitorIds] = await Promise.all([
    getDisplacementOpportunities(organizationId, 10),
    prisma.competitorKeywordGap.findMany({
      where: { organizationId },
      select: { competitorId: true },
      distinct: ['competitorId'],
    }),
  ]);

  let competitors: { id: string; name: string; domain: string | null }[] = [];
  if (gapCompetitorIds.length > 0) {
    competitors = await prisma.trackedCompetitor.findMany({
      where: {
        id: { in: gapCompetitorIds.map(g => g.competitorId) },
        isActive: true,
      },
      select: { id: true, name: true, domain: true },
    });
  }

  return NextResponse.json({ opportunities, competitors });
}
