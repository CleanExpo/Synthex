/**
 * User Account API Route
 * GET /api/user/account - Get account status
 * DELETE /api/user/account - Delete user account
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - LEGACY_PLATFORM_URL: Supabase URL (PUBLIC)
 * - LEGACY_PLATFORM_ANON_KEY: Supabase anon key (PUBLIC)
 * - LEGACY_PLATFORM_SERVICE_KEY: Service role key for admin auth deletion (SECRET)
 *
 * SECURITY: Requires authentication via Supabase token
 * DELETE requires confirmation body: { "confirmation": "DELETE_MY_ACCOUNT" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

// Validation schema for account deletion
const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE_MY_ACCOUNT', {
    error: () => ({ message: 'Must confirm with "DELETE_MY_ACCOUNT"' }),
  }),
});

// GET account status
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        lastLogin: true,
        authProvider: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get account metadata
    return NextResponse.json({
      id: user.id,
      email: user.email,
      emailConfirmed: !!user.emailVerified,
      createdAt: user.createdAt,
      lastSignIn: user.lastLogin,
      provider: user.authProvider || 'email',
      mfaEnabled: false,
    });
  } catch (error) {
    logger.error('Account fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE account
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require confirmation for account deletion
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: 'Account deletion requires confirmation',
          message: 'Send { "confirmation": "DELETE_MY_ACCOUNT" } to confirm',
        },
        { status: 400 }
      );
    }

    const validationResult = deleteAccountSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Account deletion requires confirmation',
          message: 'Send { "confirmation": "DELETE_MY_ACCOUNT" } to confirm',
        },
        { status: 400 }
      );
    }

    // Audit: record that deletion was requested before any data is removed
    await logAuditEvent({
      event: 'account.deletion_requested',
      userId,
      metadata: { provider: 'local' },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    // Delete all user data — collect errors before touching the auth record.
    // GDPR Art. 17: auth deletion must not proceed if any DB deletion fails,
    // as that would leave orphaned rows with no way to re-attempt erasure.
    const dbErrors: string[] = [];

    try {
      await prisma.session.deleteMany({ where: { userId } });
      await prisma.account.deleteMany({ where: { userId } });
      await prisma.platformConnection.deleteMany({ where: { userId } });
      await prisma.campaign.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    } catch (deleteError) {
      dbErrors.push(
        deleteError instanceof Error
          ? deleteError.message
          : 'unknown_deletion_error'
      );
    }

    if (dbErrors.length > 0) {
      logger.error('Account data deletion failed:', dbErrors);
      return NextResponse.json(
        {
          error:
            'Account deletion failed. Please try again or contact support.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully.',
    });
  } catch (error) {
    logger.error('Account deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
