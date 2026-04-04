/**
 * Sentinel Alert Acknowledge API
 *
 * POST /api/sentinel/alerts/[id]/acknowledge
 * Marks a specific alert as acknowledged (read).
 *
 * ENVIRONMENT VARIABLES:
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  const { id } = await params;

  try {
    // Verify the alert belongs to this user
    const alert = await prisma.sentinelAlert.findFirst({
      where: { id, userId },
    });

    if (!alert) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Alert not found' },
        404
      );
    }

    const updated = await prisma.sentinelAlert.update({
      where: { id },
      data: { acknowledged: true },
    });

    return APISecurityChecker.createSecureResponse({ success: true, alert: updated });
  } catch (error) {
    logger.error('[Sentinel Acknowledge] Error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to acknowledge alert' },
      500
    );
  }
}
