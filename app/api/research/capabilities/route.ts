/**
 * Research Capabilities API
 *
 * @description Returns available AI research capabilities for the user
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token verification (CRITICAL)
 *
 * FAILURE MODE: Returns appropriate error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

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
    // Return AI research capabilities based on user's plan
    const capabilities = {
      models: ['gpt-4', 'claude-3', 'gemini-pro'],
      features: [
        'competitor-analysis',
        'trend-detection',
        'market-research',
        'content-optimization'
      ],
      limits: {
        maxRequests: 100,
        maxTokens: 4000
      },
      userId: security.context.userId,
    };

    return APISecurityChecker.createSecureResponse(
      { success: true, data: capabilities },
      200,
      security.context
    );
  } catch (error) {
    console.error('Error fetching capabilities:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch capabilities' },
      500,
      security.context
    );
  }
}