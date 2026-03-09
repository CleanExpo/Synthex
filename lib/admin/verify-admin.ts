/**
 * Shared Admin Verification Utility
 *
 * Centralises admin auth logic previously copy-pasted across three route files:
 *   - app/api/admin/users/route.ts
 *   - app/api/admin/audit-log/route.ts
 *   - app/api/admin/jobs/route.ts
 *
 * Auth priority:
 *   1. x-admin-api-key header — timing-safe compare with ADMIN_API_KEY env var
 *   2. Authorization: Bearer <jwt> header
 *   3. auth-token cookie (httpOnly)
 *
 * For JWT paths, the user is looked up in Prisma and either:
 *   - isOwnerEmail() → allow (owner email bypass)
 *   - preferences.role === 'admin' | 'superadmin' → allow
 *   - Otherwise → deny
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 *   - JWT_SECRET (CRITICAL)
 *   - ADMIN_API_KEY (SECRET)
 *
 * @module lib/admin/verify-admin
 */

import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { verifyToken, isOwnerEmail } from '@/lib/auth/jwt-utils';

// =============================================================================
// Types
// =============================================================================

export interface AdminAuthResult {
  isAdmin: boolean;
  /** Present when auth succeeded via JWT (may be absent for API-key-only auth) */
  userId?: string;
  error?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// =============================================================================
// Main export
// =============================================================================

/**
 * Verify that the incoming request is authorised to access admin endpoints.
 *
 * @param request - Incoming NextRequest
 * @returns AdminAuthResult — { isAdmin, userId?, error? }
 */
export async function verifyAdmin(request: NextRequest): Promise<AdminAuthResult> {
  // ------------------------------------------------------------------
  // 1. x-admin-api-key header (timing-safe)
  // ------------------------------------------------------------------
  const apiKey = request.headers.get('x-admin-api-key');
  const configuredKey = process.env.ADMIN_API_KEY ?? '';
  if (apiKey && configuredKey && timingSafeCompare(apiKey, configuredKey)) {
    return { isAdmin: true };
  }

  // ------------------------------------------------------------------
  // 2. JWT — Authorization: Bearer header OR auth-token cookie
  // ------------------------------------------------------------------
  const authHeader = request.headers.get('authorization');
  const cookieHeader = request.headers.get('cookie');

  let token: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (cookieHeader) {
    // Parse auth-token from cookie string
    const match = cookieHeader.match(/(?:^|;\s*)auth-token=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1]);
    }
  }

  if (!token) {
    return { isAdmin: false, error: 'Authentication required' };
  }

  try {
    const decoded = verifyToken(token);

    if (!decoded.userId) {
      return { isAdmin: false, error: 'Invalid token payload' };
    }

    // Look up user in DB — always re-verify against DB to pick up suspensions / role changes
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, preferences: true },
    });

    if (!user) {
      return { isAdmin: false, userId: decoded.userId, error: 'User not found' };
    }

    // Owner email bypass — owner always has admin access regardless of DB role
    if (isOwnerEmail(user.email)) {
      return { isAdmin: true, userId: decoded.userId };
    }

    // Role-based check via preferences JSON field
    const prefs = user.preferences as { role?: string } | null;
    if (prefs?.role !== 'admin' && prefs?.role !== 'superadmin') {
      return {
        isAdmin: false,
        userId: decoded.userId,
        error: 'Admin access required',
      };
    }

    return { isAdmin: true, userId: decoded.userId };
  } catch {
    return { isAdmin: false, error: 'Invalid token' };
  }
}
