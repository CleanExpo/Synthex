/**
 * Analytics Dashboard API
 * Provides comprehensive dashboard metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyticsTracker } from '@/lib/analytics/analytics-tracker';
import { getUserIdFromCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';

export async function GET(request: NextRequest) {
  try {
    // Check authentication and get user ID
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return unauthorizedResponse();
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'dashboard';

    // Get dashboard metrics
    const dashboardMetrics = await analyticsTracker.getDashboardMetrics(userId);

    return NextResponse.json(dashboardMetrics);
  } catch (error: unknown) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard metrics' },
      { status: 500 }
    );
  }
}