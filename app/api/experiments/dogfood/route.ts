/**
 * Dog-food Check API
 *
 * GET /api/experiments/dogfood
 * Runs all Synthex analysers against synthex.social and returns a score report.
 *
 * ENVIRONMENT VARIABLES:
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { runDogfoodCheck } from '@/lib/experiments/dogfood-checker';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  const userId = security.context.userId!;

  try {
    const report = await runDogfoodCheck();

    logger.info('[dogfood] Ran dog-food check', {
      userId,
      overallScore: report.overallScore,
    });

    return APISecurityChecker.createSecureResponse({ report });
  } catch (error) {
    logger.error('[dogfood] GET failed', { error, userId });
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to run dog-food check' },
      500
    );
  }
}
