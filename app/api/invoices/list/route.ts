/**
 * Internal Invoice List API
 *
 * GET /api/invoices/list — List all invoices for the authenticated user's org
 *
 * Supports query params:
 *   status  — filter by status (draft | sent | paid | overdue | cancelled)
 *   limit   — max records (default 50, max 200)
 *   cursor  — pagination cursor (invoice ID, for keyset pagination)
 *
 * Auth: JWT via getUserIdFromRequestOrCookies
 * Org scoping: getEffectiveOrganizationId
 *
 * UNI-173
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const orgId = await getEffectiveOrganizationId(userId);
  if (!orgId) {
    return NextResponse.json(
      { error: 'No organisation context found' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const cursor = searchParams.get('cursor') ?? undefined;

  try {
    const where = {
      organizationId: orgId,
      ...(status ? { status } : {}),
    };

    const invoices = await prisma.invoice.findMany({
      where,
      include: { lineItems: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
    });

    const nextCursor =
      invoices.length === limit ? invoices[invoices.length - 1].id : null;

    return NextResponse.json({ invoices, nextCursor });
  } catch (error) {
    logger.error('[invoices/list] GET error', { error, orgId });
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}
