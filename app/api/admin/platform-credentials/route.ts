/**
 * Admin API: Platform OAuth Credentials
 *
 * GET    /api/admin/platform-credentials — List all platform OAuth credentials (masked)
 * POST   /api/admin/platform-credentials — Add or update a platform OAuth credential
 * DELETE /api/admin/platform-credentials — Remove a platform OAuth credential
 *
 * OWNER-ONLY: All routes are gated to platform owner(s) via isOwnerEmail().
 * Uses the same encryption service as AI API credentials.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { encryptApiKey, maskApiKey } from '@/lib/encryption/api-key-encryption';
import { isOwnerEmail } from '@/lib/auth/jwt-utils';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- Helpers ---

/**
 * Check whether the Prisma client is available.
 * Returns false when DATABASE_URL is missing or the client failed to initialise.
 */
function isPrismaAvailable(): boolean {
  return prisma != null && typeof prisma.platformOAuthCredential?.findMany === 'function';
}

/**
 * Determine whether a database error indicates the table has not been created yet.
 */
function isMissingTableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('P2021') ||
    msg.includes('P2010')
  );
}

/**
 * Verify the request comes from a platform owner.
 * Returns the userId on success, or a NextResponse error to return immediately.
 */
async function requireOwner(request: NextRequest): Promise<
  { userId: string } | { error: NextResponse }
> {
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ);
  if (!security.allowed) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
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

// --- Zod Schemas ---

const VALID_PLATFORMS = [
  'twitter', 'linkedin', 'instagram', 'facebook', 'tiktok',
  'youtube', 'pinterest', 'reddit', 'threads',
  'searchconsole', 'googleanalytics', 'googledrive',
] as const;

const UpsertCredentialSchema = z.object({
  platform: z.enum(VALID_PLATFORMS),
  clientId: z.string().min(5, 'Client ID is too short'),
  clientSecret: z.string().min(5, 'Client Secret is too short'),
});

const DeleteCredentialSchema = z.object({
  platform: z.string().min(1, 'Platform is required'),
});

// --- GET: list all platform credentials (masked) ---

export async function GET(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if ('error' in auth) return auth.error;

    if (!isPrismaAvailable()) {
      console.warn('[Admin Platform Credentials] Prisma client not available — returning empty list');
      return NextResponse.json({ credentials: [] });
    }

    let credentials;
    try {
      credentials = await prisma.platformOAuthCredential.findMany({
        select: {
          id: true,
          platform: true,
          maskedClientId: true,
          maskedClientSecret: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { platform: 'asc' },
      });
    } catch (dbError) {
      if (isMissingTableError(dbError)) {
        console.warn('[Admin Platform Credentials] Table not found — returning empty list');
      } else {
        console.error('[Admin Platform Credentials] Database query failed:', dbError);
      }
      return NextResponse.json({ credentials: [] });
    }

    return NextResponse.json({ credentials });
  } catch (error) {
    console.error('[Admin Platform Credentials] GET error:', error);
    return NextResponse.json(
      { error: sanitizeErrorForResponse(error, 'Failed to fetch platform credentials') },
      { status: 500 }
    );
  }
}

// --- POST: add or update a platform credential ---

export async function POST(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const parsed = UpsertCredentialSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { platform, clientId, clientSecret } = parsed.data;

    if (!isPrismaAvailable()) {
      console.error('[Admin Platform Credentials] Prisma client not available for POST');
      return NextResponse.json(
        { error: 'Database not available. Please try again later.' },
        { status: 503 }
      );
    }

    // Encrypt both values
    let encryptedClientId: string;
    let encryptedClientSecret: string;
    try {
      encryptedClientId = encryptApiKey(clientId);
      encryptedClientSecret = encryptApiKey(clientSecret);
    } catch (encErr) {
      const msg = encErr instanceof Error ? encErr.message : '';
      if (msg.includes('not found in environment')) {
        console.error('[Admin Platform Credentials] ENCRYPTION_KEY_V1 env var is missing');
        return NextResponse.json(
          { error: 'Server encryption not configured. Please contact support.' },
          { status: 503 }
        );
      }
      throw encErr;
    }

    // Mask both values for display
    const maskedClientId = maskApiKey(clientId);
    const maskedClientSecret = maskApiKey(clientSecret);

    // Upsert by platform (unique constraint)
    let credential;
    try {
      credential = await prisma.platformOAuthCredential.upsert({
        where: { platform },
        create: {
          platform,
          encryptedClientId,
          encryptedClientSecret,
          encryptionKeyVersion: 1,
          maskedClientId,
          maskedClientSecret,
          isActive: true,
          configuredByUserId: auth.userId,
        },
        update: {
          encryptedClientId,
          encryptedClientSecret,
          encryptionKeyVersion: 1,
          maskedClientId,
          maskedClientSecret,
          isActive: true,
          configuredByUserId: auth.userId,
          updatedAt: new Date(),
        },
      });
    } catch (dbError) {
      if (isMissingTableError(dbError)) {
        console.error('[Admin Platform Credentials] Table not found — run `npx prisma db push`');
        return NextResponse.json(
          { error: 'Database not configured. Please contact support.' },
          { status: 503 }
        );
      }
      throw dbError;
    }

    return NextResponse.json({
      success: true,
      credential: {
        id: credential.id,
        platform: credential.platform,
        maskedClientId: credential.maskedClientId,
        maskedClientSecret: credential.maskedClientSecret,
        isActive: credential.isActive,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Admin Platform Credentials] POST error:', error);
    return NextResponse.json(
      { error: sanitizeErrorForResponse(error, 'Failed to save platform credential') },
      { status: 500 }
    );
  }
}

// --- DELETE: remove a platform credential ---

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const parsed = DeleteCredentialSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    if (!isPrismaAvailable()) {
      console.error('[Admin Platform Credentials] Prisma client not available for DELETE');
      return NextResponse.json(
        { error: 'Database not available. Please try again later.' },
        { status: 503 }
      );
    }

    const { platform } = parsed.data;

    // Verify the credential exists before deleting
    let existing;
    try {
      existing = await prisma.platformOAuthCredential.findUnique({
        where: { platform },
      });
    } catch (dbError) {
      if (isMissingTableError(dbError)) {
        console.error('[Admin Platform Credentials] Table not found');
        return NextResponse.json(
          { error: 'Database not configured. Please contact support.' },
          { status: 503 }
        );
      }
      throw dbError;
    }

    if (!existing) {
      return NextResponse.json(
        { error: 'Credential not found for platform: ' + platform },
        { status: 404 }
      );
    }

    // Hard delete — these are admin config, not user data
    try {
      await prisma.platformOAuthCredential.delete({
        where: { platform },
      });
    } catch (dbError) {
      console.error('[Admin Platform Credentials] Failed to delete credential:', dbError);
      return NextResponse.json(
        { error: sanitizeErrorForResponse(dbError, 'Failed to delete credential') },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, platform });
  } catch (error) {
    console.error('[Admin Platform Credentials] DELETE error:', error);
    return NextResponse.json(
      { error: sanitizeErrorForResponse(error, 'Failed to delete platform credential') },
      { status: 500 }
    );
  }
}
