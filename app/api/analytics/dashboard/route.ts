/**
 * Analytics Dashboard API
 * Provides comprehensive dashboard metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyticsTracker } from '@/lib/analytics/analytics-tracker';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authToken = request.cookies.get('auth-token')?.value;
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'demo-user-001';
    const type = searchParams.get('type') || 'dashboard';

    // Get dashboard metrics
    const dashboardMetrics = await analyticsTracker.getDashboardMetrics(userId);

    return NextResponse.json(dashboardMetrics);
  } catch (error: any) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard metrics' },
      { status: 500 }
    );
  }
}