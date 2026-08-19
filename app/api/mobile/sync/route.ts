/**
 * @internal External/mobile API endpoint — not called by the web frontend.
 * Used by: mobile app SDK clients for offline data synchronisation.
 * This is an intentional external API; do not archive.
 */

/**
 * Mobile Data Sync API
 *
 * @description Handles data synchronization between mobile app and server
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token verification (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * FAILURE MODE: Returns appropriate error responses
 */

import { NextRequest } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
/**
 * POST /api/mobile/sync
 * Synchronize mobile app data with server
 *
 * The offline sync protocol and conflict persistence have not been implemented.
 * Do not acknowledge client changes until they can be durably processed.
 */
export async function POST(request: NextRequest) {
  // Security check - requires authentication with write permissions
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

  return APISecurityChecker.createSecureResponse(
    {
      error:
        'Mobile synchronisation is unavailable until offline changes can be processed and persisted.',
    },
    503,
    security.context
  );
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
