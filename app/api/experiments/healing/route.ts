/**
 * Healing Actions API
 *
 * GET /api/experiments/healing
 * Returns list of healing actions for the authenticated user.
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
    const targetUrl = searchParams.get('url') ?? undefined;
    const fixApplied = searchParams.get('fixApplied');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));

    const where = {
      userId,
      ...(severity && ['critical', 'warning'].includes(severity) ? { severity } : {}),
      ...(targetUrl ? { targetUrl } : {}),
      ...(fixApplied === 'true' ? { fixApplied: true } : {}),
      ...(fixApplied === 'false' ? { fixApplied: false } : {}),
    };

    const [actions, total] = await Promise.all([
      prisma.healingAction.findMany({
        where,
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.healingAction.count({ where }),
    ]);

    return APISecurityChecker.createSecureResponse({
      actions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('[healing] GET failed', { error, userId });
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch healing actions' },
      500
    );
  }
}
