/**
 * GBP Insights API
 *
 * GET — Performance insights for a location (from snapshots + live API)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { logger } from '@/lib/logger';

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

  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId');
  const days = parseInt(searchParams.get('days') || '30', 10);

  if (!locationId) {
    return NextResponse.json(
      { error: 'Missing locationId parameter' },
      { status: 400 }
    );
  }

  try {
    // Verify org scoping
    const location = await prisma.gBPLocation.findFirst({
      where: { id: locationId, organizationId },
    });

    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    // Get snapshots for trend
    const since = new Date();
    since.setDate(since.getDate() - days);

    const snapshots = await prisma.gBPSnapshot.findMany({
      where: {
        organizationId,
        locationId: location.id,
        date: { gte: since },
      },
      orderBy: { date: 'asc' },
    });

    // Calculate totals from snapshots
    const totals = snapshots.reduce(
      (acc, s) => ({
        searchViews: acc.searchViews + (s.searchViews ?? 0),
        mapsViews: acc.mapsViews + (s.mapsViews ?? 0),
        websiteClicks: acc.websiteClicks + (s.websiteClicks ?? 0),
        phoneClicks: acc.phoneClicks + (s.phoneClicks ?? 0),
        directionClicks: acc.directionClicks + (s.directionClicks ?? 0),
      }),
      {
        searchViews: 0,
        mapsViews: 0,
        websiteClicks: 0,
        phoneClicks: 0,
        directionClicks: 0,
      }
    );

    // Latest review stats
    const latestSnapshot =
      snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

    return NextResponse.json({
      success: true,
      totals,
      totalReviews: latestSnapshot?.totalReviews,
      averageRating: latestSnapshot?.averageRating,
      trend: snapshots.map(s => ({
        date: s.date.toISOString().split('T')[0],
        searchViews: s.searchViews,
        mapsViews: s.mapsViews,
        websiteClicks: s.websiteClicks,
        phoneClicks: s.phoneClicks,
        directionClicks: s.directionClicks,
      })),
    });
  } catch (error) {
    logger.error('GBP insights error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}
