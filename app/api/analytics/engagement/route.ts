/**
 * Engagement Analytics API
 * Track and update engagement metrics for posts
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyticsTracker } from '@/lib/analytics/analytics-tracker';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authToken = request.cookies.get('auth-token')?.value;
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { contentId, platform, metrics } = body;

    if (!contentId || !platform || !metrics) {
      return NextResponse.json(
        { error: 'contentId, platform, and metrics are required' },
        { status: 400 }
      );
    }

    // Track engagement metrics
    await analyticsTracker.trackEngagement(contentId, platform, metrics);

    return NextResponse.json({
      success: true,
      message: 'Engagement metrics updated',
      data: {
        contentId,
        platform,
        metrics
      }
    });
  } catch (error: unknown) {
    console.error('Engagement tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track engagement' },
      { status: 500 }
    );
  }
}