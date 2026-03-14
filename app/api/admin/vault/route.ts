/**
 * Admin API: Vault Secrets Management
 *
 * GET    /api/admin/vault — List secrets (metadata only, masked)
 * POST   /api/admin/vault — Create a new secret
 * PATCH  /api/admin/vault — Rotate a secret's value
 * DELETE /api/admin/vault — Soft-delete a secret
 *
 * OWNER-ONLY: All routes are gated to platform owner(s) via isOwnerEmail().
 * Pattern: mirrors app/api/admin/platform-credentials/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isOwnerEmail } from '@/lib/auth/jwt-utils';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { logger } from '@/lib/logger';
import {
  VaultService,
  CreateSecretSchema,
  RotateSecretSchema,
  DeleteSecretSchema,
  ListSecretsQuerySchema,
  slugify,
} from '@/lib/vault';
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

  const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
  const userAgent = request.headers.get('user-agent') ?? 'unknown';

  return { userId, ipAddress, userAgent };
}

function buildActor(auth: { userId: string; ipAddress: string; userAgent: string }): VaultActor {
  return {
    id: auth.userId,
    type: 'user',
    ipAddress: auth.ipAddress,
    userAgent: auth.userAgent,
  };
}

// --- GET: list secrets (metadata only) ---

export async function GET(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if ('error' in auth) return auth.error;

    if (!isPrismaAvailable()) {
      logger.warn('[Vault API] Prisma client not available — returning empty list');
      return NextResponse.json({ secrets: [], total: 0 });
    }

    const url = new URL(request.url);
    const query = ListSecretsQuerySchema.safeParse({
      organizationId: url.searchParams.get('organizationId') ?? '',
      secretType: url.searchParams.get('secretType') || undefined,
      provider: url.searchParams.get('provider') || undefined,
      includeInactive: url.searchParams.get('includeInactive') || undefined,
    });

    if (!query.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: query.error.errors },
        { status: 400 }
      );
    }

    try {
      const secrets = await VaultService.listSecrets(query.data.organizationId, {
        secretType: query.data.secretType,
        provider: query.data.provider,
        includeInactive: query.data.includeInactive,
      });

      return NextResponse.json({ secrets, total: secrets.length });
    } catch (dbError) {
      if (isMissingTableError(dbError)) {
        logger.warn('[Vault API] Table not found — returning empty list');
        return NextResponse.json({ secrets: [], total: 0 });
      }
      throw dbError;
    }
  } catch (error) {
    logger.error('[Vault API] GET error:', error);
    return NextResponse.json(
      { error: sanitizeErrorForResponse(error, 'Failed to fetch vault secrets') },
      { status: 500 }
    );
  }
}

// --- POST: create a new secret ---

export async function POST(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const parsed = CreateSecretSchema.safeParse(body);

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

    const { organizationId, name, secretType, provider, value, description, expiresAt, isRotatable } = parsed.data;
    const slug = parsed.data.slug ?? slugify(name);

    // Encrypt + mask
    const prepared = VaultService.prepareSecret(value);
    if (!prepared) {
      return NextResponse.json(
        { error: 'Server encryption not configured. Please contact support.' },
        { status: 503 }
      );
    }

    try {
      const secret = await VaultService.createSecret(
        {
          organizationId,
          name,
          slug,
          description,
          secretType,
          provider,
          encryptedValue: prepared.encrypted,
          maskedValue: prepared.masked,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          isRotatable: isRotatable ?? false,
          source: 'manual',
          createdBy: auth.userId,
        },
        buildActor(auth)
      );

      return NextResponse.json({ success: true, secret });
    } catch (dbError) {
      if (isMissingTableError(dbError)) {
        return NextResponse.json(
          { error: 'Database not configured. Please run migrations.' },
          { status: 503 }
        );
      }
      // Handle unique constraint violation
      const msg = dbError instanceof Error ? dbError.message : String(dbError);
      if (msg.includes('Unique constraint') || msg.includes('P2002')) {
        return NextResponse.json(
          { error: `Secret with slug "${slug}" already exists for this organisation.` },
          { status: 409 }
        );
      }
      throw dbError;
    }
  } catch (error) {
    logger.error('[Vault API] POST error:', error);
    return NextResponse.json(
      { error: sanitizeErrorForResponse(error, 'Failed to create vault secret') },
      { status: 500 }
    );
  }
}

// --- PATCH: rotate a secret's value ---

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const parsed = RotateSecretSchema.safeParse(body);

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

    const { organizationId, slug, newValue } = parsed.data;

    try {
      const secret = await VaultService.rotateSecret(organizationId, slug, newValue, buildActor(auth));

      if (!secret) {
        return NextResponse.json(
          { error: `Secret "${slug}" not found or inactive.` },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, secret });
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
    logger.error('[Vault API] PATCH error:', error);
    return NextResponse.json(
      { error: sanitizeErrorForResponse(error, 'Failed to rotate vault secret') },
      { status: 500 }
    );
  }
}

// --- DELETE: soft-delete a secret ---

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const parsed = DeleteSecretSchema.safeParse(body);

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

    const { organizationId, slug } = parsed.data;

    try {
      const deleted = await VaultService.deleteSecret(organizationId, slug, buildActor(auth));

      if (!deleted) {
        return NextResponse.json(
          { error: `Secret "${slug}" not found.` },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, slug });
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
    logger.error('[Vault API] DELETE error:', error);
    return NextResponse.json(
      { error: sanitizeErrorForResponse(error, 'Failed to delete vault secret') },
      { status: 500 }
    );
  }
}
