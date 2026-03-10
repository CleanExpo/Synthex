/**
 * Trends Research API
 *
 * @description Returns trending topics and market insights
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token verification (CRITICAL)
 *
 * FAILURE MODE: Returns appropriate error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  // Security check - requires authentication
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error || 'Authentication required' },
      security.error?.includes('Rate limit') ? 429 : 401,
      security.context
    );
  }

  try {
    // Parse query parameters for filtering
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);

    // Mock trending topics - would connect to real trend API
    let trends = [
      { topic: 'AI Marketing', score: 95, growth: '+23%', category: 'technology' },
      { topic: 'Sustainability', score: 87, growth: '+18%', category: 'environment' },
      { topic: 'Remote Work', score: 82, growth: '+12%', category: 'business' },
      { topic: 'Web3', score: 76, growth: '+8%', category: 'technology' }
    ];

    // Filter by category if specified
    if (category) {
      trends = trends.filter(t => t.category === category);
    }

    // Apply limit
    trends = trends.slice(0, limit);

    return APISecurityChecker.createSecureResponse(
      {
        success: true,
        trends,
        fetchedAt: new Date().toISOString(),
        userId: security.context.userId,
      },
      200,
      security.context
    );
  } catch (error) {
    logger.error('Error fetching trends:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch trends' },
      500,
      security.context
    );
  }
}