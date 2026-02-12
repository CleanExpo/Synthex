/**
 * Engagement Analytics API
 * Track and update engagement metrics for posts
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 *
 * SECURITY: POST requires authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyticsTracker } from '@/lib/analytics/analytics-tracker';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

export async function POST(request: NextRequest) {
  try {
    // Proper authentication check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );
    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error || 'Authentication required' },
        security.error?.includes('Rate limit') ? 429 : 401,
        security.context
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