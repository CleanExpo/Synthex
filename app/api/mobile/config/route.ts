/**
 * @internal External/mobile API endpoint — not called by the web frontend.
 * Used by: mobile app SDK clients for runtime configuration.
 * This is an intentional external API; do not archive.
 */

/**
 * Mobile App Configuration API
 *
 * @description Provides configuration for mobile app clients
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token verification (CRITICAL)
 *
 * FAILURE MODE: Returns appropriate error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';

/**
 * GET /api/mobile/config
 * Get mobile app configuration for authenticated user
 */
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
    // Return mobile configuration
    const config = {
      version: '1.0.0',
      minVersion: '1.0.0',
      features: {
        pushNotifications: true,
        offlineMode: true,
        biometricAuth: true,
        darkMode: true,
      },
      endpoints: {
        api: process.env.NEXT_PUBLIC_APP_URL || '',
      },
      userId: security.context.userId,
    };

    return APISecurityChecker.createSecureResponse(
      config,
      200,
      security.context
    );
  } catch (error) {
    logger.error('Error fetching mobile config:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch mobile configuration' },
      500,
      security.context
    );
  }
}
