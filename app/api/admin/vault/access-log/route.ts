/**
 * Admin API: Vault Access Logs
 *
 * GET /api/admin/vault/access-log — Paginated audit trail for vault operations
 *
 * OWNER-ONLY: Gated via isOwnerEmail().
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isOwnerEmail } from '@/lib/auth/jwt-utils';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { logger } from '@/lib/logger';
import { VaultService, AccessLogQuerySchema } from '@/lib/vault';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- Helpers (shared pattern) ---

function isPrismaAvailable(): boolean {
  return prisma != null && typeof prisma.vaultAccessLog?.findMany === 'function';
}

function isMissingTableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('P2021') ||
    msg.includes('P2010')
  );
}

async function requireOwner(request: NextRequest): Promise<
  { userId: string } | { error: NextResponse }
> {
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ);
  if (!security.allowed) {
    return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };
  }

  const userId = security.context.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user?.email || !isOwnerEmail(user.email)) {
    return { error: NextResponse.json({ error: 'Forbidden', message: 'Owner access required' }, { status: 403 }) };
  }

  return { userId };
}

// --- GET: paginated access logs ---

export async function GET(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if ('error' in auth) return auth.error;

    if (!isPrismaAvailable()) {
      logger.warn('[Vault Access Log API] Prisma client not available — returning empty');
      return NextResponse.json({ logs: [], total: 0 });
    }

    const url = new URL(request.url);
    const query = AccessLogQuerySchema.safeParse({
      organizationId: url.searchParams.get('organizationId') ?? '',
      vaultSecretId: url.searchParams.get('vaultSecretId') || undefined,
      action: url.searchParams.get('action') || undefined,
      limit: url.searchParams.get('limit') || undefined,
      offset: url.searchParams.get('offset') || undefined,
    });

    if (!query.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: query.error.errors },
        { status: 400 }
      );
    }

    try {
      const result = await VaultService.getAccessLogs(query.data.organizationId, {
        vaultSecretId: query.data.vaultSecretId,
        action: query.data.action,
        limit: query.data.limit,
        offset: query.data.offset,
      });

      return NextResponse.json(result);
    } catch (dbError) {
      if (isMissingTableError(dbError)) {
        logger.warn('[Vault Access Log API] Table not found — returning empty');
        return NextResponse.json({ logs: [], total: 0 });
      }
      throw dbError;
    }
  } catch (error) {
    logger.error('[Vault Access Log API] GET error:', error);
    return NextResponse.json(
      { error: sanitizeErrorForResponse(error, 'Failed to fetch vault access logs') },
      { status: 500 }
    );
  }
}
