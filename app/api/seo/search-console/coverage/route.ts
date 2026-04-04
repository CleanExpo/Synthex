/**
 * GSC Coverage Report API
 *
 * GET /api/seo/search-console/coverage — Index coverage metrics from snapshots
 *
 * @module app/api/seo/search-console/coverage/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ);
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);

  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const siteUrl = searchParams.get('siteUrl');

    if (!siteUrl) {
      return NextResponse.json({ error: 'Missing siteUrl parameter' }, { status: 400 });
    }

    // Get the latest snapshot for this property
    const latestSnapshot = await prisma.gSCSnapshot.findFirst({
      where: { organizationId, siteUrl },
      orderBy: { date: 'desc' },
    });

    // Get last 30 days of snapshots for trend data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const snapshots = await prisma.gSCSnapshot.findMany({
      where: {
        organizationId,
        siteUrl,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'asc' },
      take: 90, // max 90 days of daily snapshots
    });

    return NextResponse.json({
      success: true,
      coverage: latestSnapshot
        ? {
            indexed: latestSnapshot.indexedPages ?? 0,
            errors: latestSnapshot.errorPages ?? 0,
            warnings: latestSnapshot.warningPages ?? 0,
            excluded: latestSnapshot.excludedPages ?? 0,
          }
        : null,
      trend: snapshots.map((s) => ({
        date: s.date.toISOString().split('T')[0],
        clicks: s.clicks,
        impressions: s.impressions,
        ctr: s.ctr,
        position: s.position,
        indexed: s.indexedPages,
        errors: s.errorPages,
      })),
    });
  } catch (error) {
    logger.error('GSC coverage report error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coverage report' },
      { status: 500 }
    );
  }
}
