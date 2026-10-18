/**
 * POST /api/founder/delete-account
 *
 * Privacy Act (Australia) APP 11 — user data deletion endpoint.
 * Deletes the authenticated user's account and all associated data.
 *
 * Flow:
 *  1. Auth check — valid session required
 *  2. Body validation — must include confirmation string "DELETE MY ACCOUNT"
 *  3. Best-effort OAuth token revocation across all connected platforms
 *  4. Delete the user row via Prisma (ON DELETE CASCADE handles dependent tables)
 *  5. Return 200
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET (CRITICAL)
 * - DATABASE_URL (CRITICAL)
 * - FIELD_ENCRYPTION_KEY — for decrypting OAuth tokens before revocation
 *
 * @module app/api/founder/delete-account/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { revokePlatformTokens } from '@/lib/oauth';
import { isSupportedPlatform } from '@/lib/oauth';
import { decryptFieldSafe } from '@/lib/security/field-encryption';
import { logger } from '@/lib/logger';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { writeDefault } from '@/lib/middleware/api-rate-limit';

// =============================================================================
// Schema
// =============================================================================

const DeleteAccountSchema = z.object({
  confirmation: z.literal('DELETE MY ACCOUNT'),
});

// =============================================================================
// POST — Delete Account
// =============================================================================

export async function POST(request: NextRequest) {
  return writeDefault(request, async () => {
    // 1. Auth check
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return unauthorizedResponse(
        'Authentication required to delete your account'
      );
    }

    // 2. Body validation
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body', details: 'Body must be valid JSON' },
        { status: 400 }
      );
    }

    const parsed = DeleteAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten(),
          hint: 'Body must contain { "confirmation": "DELETE MY ACCOUNT" }',
        },
        { status: 400 }
      );
    }

    // 3. Best-effort OAuth token revocation
    // Fetch all active platform connections for this user so we can revoke tokens
    // with the upstream provider before the DB rows are cascaded away.
    try {
      const connections = await prisma.platformConnection.findMany({
        where: { userId, isActive: true },
        select: { platform: true, accessToken: true },
      });

      if (connections.length > 0) {
        // Revoke in parallel — failures are non-fatal
        const revocations = connections.map(async conn => {
          try {
            if (!isSupportedPlatform(conn.platform)) return;

            const rawToken = decryptFieldSafe(conn.accessToken);
            if (!rawToken) return;

            await revokePlatformTokens(conn.platform, rawToken);
            logger.info('[DELETE_ACCOUNT] Revoked token', {
              userId,
              platform: conn.platform,
            });
          } catch (err) {
            // Non-fatal — log and continue
            logger.warn(
              '[DELETE_ACCOUNT] Token revocation failed (non-fatal)',
              {
                userId,
                platform: conn.platform,
                error: err instanceof Error ? err.message : String(err),
              }
            );
          }
        });

        await Promise.allSettled(revocations);
      }
    } catch (err) {
      // Non-fatal — log and continue to deletion
      logger.warn('[DELETE_ACCOUNT] OAuth revocation phase error (non-fatal)', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 4. Delete the user — ON DELETE CASCADE handles all dependent tables.
    // Sessions and accounts go in the same transaction so a failure leaves
    // nothing half-erased.
    try {
      await prisma.$transaction([
        prisma.session.deleteMany({ where: { userId } }),
        prisma.account.deleteMany({ where: { userId } }),
        prisma.user.delete({ where: { id: userId } }),
      ]);
    } catch (deleteError) {
      logger.error('[DELETE_ACCOUNT] Failed to delete user', {
        userId,
        error:
          deleteError instanceof Error
            ? deleteError.message
            : String(deleteError),
      });
      return NextResponse.json(
        {
          error: 'Account deletion failed',
          message: sanitizeErrorForResponse(
            deleteError,
            'Unable to delete account at this time'
          ),
        },
        { status: 500 }
      );
    }

    logger.info('[DELETE_ACCOUNT] Account permanently deleted', { userId });

    // 5. Return 200 — client should clear session and redirect to marketing page
    return NextResponse.json(
      {
        message:
          'Your account has been permanently deleted. All personal data has been removed.',
      },
      { status: 200 }
    );
  });
}
