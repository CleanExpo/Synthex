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
 *  4. Delete from auth.users via Supabase admin client (ON DELETE CASCADE handles all dependent tables)
 *  5. Return 200
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET (CRITICAL)
 * - NEXT_PUBLIC_SUPABASE_URL (CRITICAL)
 * - SUPABASE_SERVICE_ROLE_KEY (CRITICAL)
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
import { createServerClient } from '@/lib/supabase-server';
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

    const supabase = createServerClient();

    // 3. Best-effort OAuth token revocation
    // Fetch all active platform connections for this user so we can revoke tokens
    // with the upstream provider before the DB rows are cascaded away.
    try {
      const { data: connections, error: connectionsError } = await supabase
        .from('platform_connections')
        .select('platform, access_token')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (connectionsError) {
        logger.warn(
          '[DELETE_ACCOUNT] Could not fetch platform connections for revocation',
          {
            userId,
            error: connectionsError.message,
          }
        );
      } else if (connections && connections.length > 0) {
        // Revoke in parallel — failures are non-fatal
        const revocations = connections.map(async conn => {
          try {
            if (!isSupportedPlatform(conn.platform)) return;

            const rawToken = decryptFieldSafe(conn.access_token);
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

    // 4. Delete from auth.users — ON DELETE CASCADE handles all dependent tables
    // The admin client is required; the anon client cannot delete auth users.
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      logger.error('[DELETE_ACCOUNT] Failed to delete user from auth.users', {
        userId,
        error: deleteError.message,
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
