/**
 * API Settings: AI Provider Credentials
 *
 * GET  /api/settings/api-credentials — List all AI provider credentials for the user
 * POST /api/settings/api-credentials — Add or update an AI provider credential
 * DELETE /api/settings/api-credentials — Revoke an AI provider credential
 *
 * Reuses the same encryption and validation services as the onboarding flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { encryptApiKey, maskApiKey } from '@/lib/encryption/api-key-encryption';
import { validateAPIKey, APIProvider } from '@/lib/encryption/api-key-validator';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- Helpers ---

/**
 * Check whether the Prisma client is available.
 * Returns false when DATABASE_URL is missing or the client failed to initialise
 * (e.g. during static generation or a cold-start without a DB connection).
 */
function isPrismaAvailable(): boolean {
  return prisma != null && typeof prisma.aPICredential?.findMany === 'function';
}

/**
 * Determine whether a database error indicates the api_credentials table
 * has not been created yet (common on first deploy before `prisma db push`).
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

// --- GET: list credentials ---

export async function GET(request: NextRequest) {
  try {
    const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ);
    if (!security.allowed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = security.context.userId!;

    // If Prisma client is not available, return empty list gracefully
    if (!isPrismaAvailable()) {
      logger.warn('[Settings API Credentials] Prisma client not available — returning empty list');
      return NextResponse.json({ credentials: [] });
    }

    let credentials;
    try {
      credentials = await prisma.aPICredential.findMany({
        where: {
          userId,
          revokedAt: null,
        },
        select: {
          id: true,
          provider: true,
          maskedKey: true,
          isValid: true,
          isActive: true,
          lastValidatedAt: true,
          lastUsedAt: true,
          validationError: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (dbError) {
      // For the GET/read-only endpoint, any database failure should return an
      // empty list rather than crashing the Settings UI.  We log the actual
      // error for debugging but never surface it to the client.
      if (isMissingTableError(dbError)) {
        logger.warn('[Settings API Credentials] api_credentials table not found — returning empty list');
      } else {
        logger.error('[Settings API Credentials] Database query failed:', dbError);
      }
      return NextResponse.json({ credentials: [] });
    }

    return NextResponse.json({ credentials });
  } catch (error) {
    logger.error('[Settings API Credentials] GET error:', error);
    return NextResponse.json(
      { error: sanitizeErrorForResponse(error, 'Failed to fetch credentials') },
      { status: 500 }
    );
  }
}

// --- POST: add or update credential ---

const AddCredentialSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'openrouter']),
  apiKey: z.string().min(10, 'API key is too short'),
});

export async function POST(request: NextRequest) {
  try {
    const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ);
    if (!security.allowed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = security.context.userId!;

    const body = await request.json();
    const parsed = AddCredentialSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { provider, apiKey } = parsed.data;

    // Validate key with the actual provider
    const validation = await validateAPIKey(provider as APIProvider, apiKey);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: validation.error || 'Invalid API key',
          provider,
        },
        { status: 400 }
      );
    }

    // Guard: Prisma must be available for write operations
    if (!isPrismaAvailable()) {
      logger.error('[Settings API Credentials] Prisma client not available for POST');
      return NextResponse.json(
        { error: 'Database not available. Please try again later.' },
        { status: 503 }
      );
    }

    // Encrypt and mask
    let encryptedKey: string;
    try {
      encryptedKey = encryptApiKey(apiKey);
    } catch (encErr) {
      const msg = encErr instanceof Error ? encErr.message : '';
      if (msg.includes('not found in environment')) {
        logger.error('[Settings API Credentials] ENCRYPTION_KEY_V1 env var is missing');
        return NextResponse.json(
          { error: 'Server encryption not configured. Please contact support.' },
          { status: 503 }
        );
      }
      throw encErr;
    }
    const maskedKey = maskApiKey(apiKey);

    // Upsert: find existing for this user+provider (without org), or create new
    let credential;
    try {
      const existing = await prisma.aPICredential.findFirst({
        where: {
          userId,
          provider,
          organizationId: null,
          revokedAt: null,
        },
      });

      if (existing) {
        credential = await prisma.aPICredential.update({
          where: { id: existing.id },
          data: {
            encryptedKey,
            maskedKey,
            isValid: true,
            isActive: true,
            lastValidatedAt: new Date(),
            validationError: null,
            updatedAt: new Date(),
          },
        });
      } else {
        credential = await prisma.aPICredential.create({
          data: {
            userId,
            organizationId: null,
            provider,
            encryptedKey,
            maskedKey,
            isValid: true,
            isActive: true,
            lastValidatedAt: new Date(),
          },
        });
      }
    } catch (dbError) {
      if (isMissingTableError(dbError)) {
        // NOTE: The api_credentials table needs to be created. Run `npx prisma db push`.
        logger.error('[Settings API Credentials] api_credentials table not found — run `npx prisma db push`');
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
        provider: credential.provider,
        maskedKey: credential.maskedKey,
        isValid: credential.isValid,
        isActive: credential.isActive,
        lastValidatedAt: credential.lastValidatedAt,
        createdAt: credential.createdAt,
      },
    });
  } catch (error) {
    logger.error('[Settings API Credentials] POST error:', error);
    return NextResponse.json(
      { error: sanitizeErrorForResponse(error, 'Failed to save credential') },
      { status: 500 }
    );
  }
}

// --- DELETE: revoke a credential ---

const DeleteCredentialSchema = z.object({
  id: z.string().min(1),
});

export async function DELETE(request: NextRequest) {
  try {
    const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ);
    if (!security.allowed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = security.context.userId!;

    const body = await request.json();
    const parsed = DeleteCredentialSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    // Guard: Prisma must be available for write operations
    if (!isPrismaAvailable()) {
      logger.error('[Settings API Credentials] Prisma client not available for DELETE');
      return NextResponse.json(
        { error: 'Database not available. Please try again later.' },
        { status: 503 }
      );
    }

    // Verify ownership before deleting
    let credential;
    try {
      credential = await prisma.aPICredential.findFirst({
        where: {
          id: parsed.data.id,
          userId,
        },
      });
    } catch (dbError) {
      if (isMissingTableError(dbError)) {
        logger.error('[Settings API Credentials] api_credentials table not found');
        return NextResponse.json(
          { error: 'Database not configured. Please contact support.' },
          { status: 503 }
        );
      }
      throw dbError;
    }

    if (!credential) {
      return NextResponse.json(
        { error: 'Credential not found' },
        { status: 404 }
      );
    }

    // Soft-delete: mark as revoked + inactive
    try {
      await prisma.aPICredential.update({
        where: { id: credential.id },
        data: {
          isActive: false,
          revokedAt: new Date(),
        },
      });
    } catch (dbError) {
      logger.error('[Settings API Credentials] Failed to soft-delete credential:', dbError);
      return NextResponse.json(
        { error: sanitizeErrorForResponse(dbError, 'Failed to delete credential') },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Settings API Credentials] DELETE error:', error);
    return NextResponse.json(
      { error: sanitizeErrorForResponse(error, 'Failed to delete credential') },
      { status: 500 }
    );
  }
}
