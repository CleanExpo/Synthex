/**
 * Google Account Unlinking Route
 *
 * Removes Google authentication from a user account.
 *
 * @route POST /api/auth/unlink/google
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns 400 if user has no other auth methods
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { accountService } from '@/lib/auth/account-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Get and validate auth token
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if unlinking is allowed
    const canUnlink = await accountService.canUnlinkAccount(userId, 'google');

    if (!canUnlink.canUnlink) {
      return NextResponse.json(
        {
          error: canUnlink.reason,
          remainingMethods: canUnlink.remainingMethods,
        },
        { status: 400 }
      );
    }

    // Unlink the account
    const result = await accountService.unlinkAccount(userId, 'google');

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Google account unlinked successfully',
      remainingMethods: result.remainingMethods,
    });
  } catch (error) {
    logger.error('[Unlink Google] Error:', error);
    return NextResponse.json(
      { error: 'Failed to unlink Google account' },
      { status: 500 }
    );
  }
}

// Also support DELETE method
export async function DELETE(request: NextRequest) {
  return POST(request);
}

export const runtime = 'nodejs';
