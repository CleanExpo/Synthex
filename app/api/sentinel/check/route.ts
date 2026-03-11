/**
 * Sentinel Manual Check API
 *
 * POST /api/sentinel/check
 * Triggers an immediate health check for the authenticated user's site.
 * Returns the health report and any new alerts generated.
 *
 * ENVIRONMENT VARIABLES:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON: GSC credentials (OPTIONAL)
 * - GOOGLE_PAGESPEED_API_KEY: PSI API key (OPTIONAL)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { runSentinelCheck } from '@/lib/sentinel/sentinel-agent';
import { logger } from '@/lib/logger';

export const maxDuration = 60; // 60 seconds — PSI calls can be slow

export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  const userId = security.context.userId!;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    const orgId = user?.organizationId ?? '';

    const result = await runSentinelCheck(userId, orgId);

    return APISecurityChecker.createSecureResponse({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[Sentinel Check] Error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Health check failed' },
      500
    );
  }
}
