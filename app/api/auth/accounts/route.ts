/**
 * User Accounts API Route
 *
 * Retrieves the list of linked authentication accounts for the current user.
 *
 * @route GET /api/auth/accounts
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns 401 if not authenticated
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { accountService } from '@/lib/auth/account-service';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export async function GET(request: NextRequest) {
  try {
    // Get and validate auth token
    const token =
      request.cookies.get('auth-token')?.value ||
      request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify token and get user ID
    let userId: string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
      userId = decoded.sub;
    } catch {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Get all linked accounts
    const accounts = await accountService.getAccountsByUserId(userId);

    // Check unlink eligibility for each account
    const accountsWithUnlinkStatus = await Promise.all(
      accounts.map(async (account) => {
        const canUnlink = await accountService.canUnlinkAccount(
          userId,
          account.provider
        );
        return {
          ...account,
          canUnlink: canUnlink.canUnlink,
          unlinkReason: canUnlink.reason,
        };
      })
    );

    return NextResponse.json({
      accounts: accountsWithUnlinkStatus,
      totalAccounts: accounts.length,
    });
  } catch (error) {
    console.error('[Accounts API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve accounts' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
