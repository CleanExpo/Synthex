/**
 * @internal Server-only endpoint — not called directly by frontend UI.
 * Used by: mobile app SDK clients for runtime configuration.
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
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

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
        websocket: process.env.NEXT_PUBLIC_WS_URL || '',
      },
      userId: security.context.userId,
    };

    return APISecurityChecker.createSecureResponse(
      config,
      200,
      security.context
    );
  } catch (error) {
    console.error('Error fetching mobile config:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch mobile configuration' },
      500,
      security.context
    );
  }
}

