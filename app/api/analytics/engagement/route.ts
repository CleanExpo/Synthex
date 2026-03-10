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
import { z } from 'zod';
import { analyticsTracker } from '@/lib/analytics/analytics-tracker';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';

const engagementSchema = z.object({
  contentId: z.string().min(1),
  platform: z.string().min(1),
  metrics: z.record(z.unknown()),
});

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
    const validation = engagementSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { contentId, platform, metrics } = validation.data;

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
    logger.error('Engagement tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track engagement' },
      { status: 500 }
    );
  }
}