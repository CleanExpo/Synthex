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
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';

// Lazy getter to avoid module load crash
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET required');
  return secret;
}

export async function GET(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_READ
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

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
      const decoded = jwt.verify(token, getJWTSecret()) as { sub: string };
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

    // Audit log the successful retrieval
    await auditLogger.log({
      userId,
      action: 'auth.accounts_retrieved',
      resource: 'accounts',
      resourceId: userId,
      category: 'auth',
      severity: 'low',
      outcome: 'success',
      details: { accountCount: accounts.length },
    });

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
