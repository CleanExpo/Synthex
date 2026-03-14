/**
 * Admin API: Vault Secret Decrypt
 *
 * POST /api/admin/vault/decrypt — Return a decrypted secret value
 *
 * OWNER-ONLY + HEAVY AUDIT LOGGING
 * This is the most sensitive endpoint in the vault system.
 * Every call is logged with actor, IP, user agent, and reason.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isOwnerEmail } from '@/lib/auth/jwt-utils';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { logger } from '@/lib/logger';
import { VaultService, DecryptSecretSchema } from '@/lib/vault';
import type { VaultActor } from '@/lib/vault';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- Helpers ---

function isPrismaAvailable(): boolean {
  return prisma != null && typeof prisma.vaultSecret?.findMany === 'function';
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
  { userId: string; ipAddress: string; userAgent: string } | { error: NextResponse }
> {
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE);
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

  const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
  const userAgent = request.headers.get('user-agent') ?? 'unknown';

  return { userId, ipAddress, userAgent };
}

// --- POST: decrypt a secret ---

export async function POST(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const parsed = DecryptSecretSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    if (!isPrismaAvailable()) {
      return NextResponse.json(
        { error: 'Database not available. Please try again later.' },
        { status: 503 }
      );
    }

    const { organizationId, slug, reason } = parsed.data;

    const actor: VaultActor = {
      id: auth.userId,
      type: 'user',
      ipAddress: auth.ipAddress,
      userAgent: auth.userAgent,
    };

    // Log the decrypt reason prominently
    logger.info('[Vault Decrypt] Decrypt requested', {
      userId: auth.userId,
      organizationId,
      slug,
      reason: reason ?? 'none provided',
      ip: auth.ipAddress,
    });

    try {
      const decrypted = await VaultService.getSecret(organizationId, slug, actor);

      if (decrypted === null) {
        return NextResponse.json(
          { error: `Secret "${slug}" not found, inactive, or decryption failed.` },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, value: decrypted });
    } catch (dbError) {
      if (isMissingTableError(dbError)) {
        return NextResponse.json(
          { error: 'Database not configured. Please run migrations.' },
          { status: 503 }
        );
      }
      throw dbError;
    }
  } catch (error) {
    logger.error('[Vault Decrypt API] POST error:', error);
    return NextResponse.json(
      { error: sanitizeErrorForResponse(error, 'Failed to decrypt vault secret') },
      { status: 500 }
    );
  }
}
