/**
 * Analytics Dashboard API
 * Provides comprehensive dashboard metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyticsTracker } from '@/lib/analytics/analytics-tracker';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Check authentication and get user ID
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    // Org-scope layer: resolve the user's organisation for downstream scoping
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    const organizationId = userRecord?.organizationId ?? null;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'dashboard';

    // Get dashboard metrics (scoped to the authenticated user)
    const dashboardMetrics = await analyticsTracker.getDashboardMetrics(userId);

    return NextResponse.json({ ...dashboardMetrics, organizationId });
  } catch (error: unknown) {
    logger.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard metrics' },
      { status: 500 }
    );
  }
}
