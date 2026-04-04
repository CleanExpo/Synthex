/**
 * Sentinel Alerts API
 *
 * GET /api/sentinel/alerts?severity=critical|warning|info&page=1&limit=20
 * Returns paginated alert list for the authenticated user.
 *
 * ENVIRONMENT VARIABLES:
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
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
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity') ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));
    const acknowledged = searchParams.get('acknowledged');

    const where = {
      userId,
      ...(severity && ['critical', 'warning', 'info'].includes(severity) ? { severity } : {}),
      ...(acknowledged === 'false' ? { acknowledged: false } : {}),
      ...(acknowledged === 'true' ? { acknowledged: true } : {}),
    };

    const [alerts, total] = await Promise.all([
      prisma.sentinelAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sentinelAlert.count({ where }),
    ]);

    return APISecurityChecker.createSecureResponse({
      alerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('[Sentinel Alerts] Error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch alerts' },
      500
    );
  }
}
