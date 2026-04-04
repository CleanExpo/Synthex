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
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { accountService } from '@/lib/auth/account-service';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';
import { logger } from '@/lib/logger';

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
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
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
    logger.error('[Accounts API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve accounts' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
