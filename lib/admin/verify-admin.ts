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
import {
  getUserIdFromRequestOrCookies,
  isOwnerEmail,
} from '@/lib/auth/jwt-utils';
// Uses centralised auth — getUserIdFromRequestOrCookies() from lib/auth/jwt-utils

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
 * Look up a user's email by userId for server-component admin guards.
 * Provides a service-layer wrapper so layouts don't import Prisma directly.
 */
export async function getUserEmailById(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return user?.email ?? null;
}

/**
 * Verify that the incoming request is authorised to access admin endpoints.
 *
 * Auth chain:
 *   1. x-admin-api-key header — timing-safe compare with ADMIN_API_KEY env var
 *   2. JWT userId via getUserIdFromRequestOrCookies() from lib/auth/jwt-utils
 *      (reads httpOnly auth-token cookie first, then Authorization: Bearer header)
 *   3. DB lookup to confirm user exists and has admin/superadmin role or owner email
 *
 * @param request - Incoming NextRequest
 * @returns AdminAuthResult — { isAdmin, userId?, error? }
 */
export async function verifyAdmin(
  request: NextRequest
): Promise<AdminAuthResult> {
  // ------------------------------------------------------------------
  // 1. x-admin-api-key header (timing-safe)
  // ------------------------------------------------------------------
  const apiKey = request.headers.get('x-admin-api-key');
  const configuredKey = process.env.ADMIN_API_KEY ?? '';
  if (apiKey && configuredKey && timingSafeCompare(apiKey, configuredKey)) {
    return { isAdmin: true };
  }

  // ------------------------------------------------------------------
  // 2. JWT — uses centralised getUserIdFromRequestOrCookies() from lib/auth/jwt-utils
  //    (httpOnly cookie → Authorization: Bearer fallback)
  // ------------------------------------------------------------------
  const userId = await getUserIdFromRequestOrCookies(request);

  if (!userId) {
    return { isAdmin: false, error: 'Authentication required' };
  }

  // ------------------------------------------------------------------
  // 3. DB lookup — always re-verify to pick up suspensions / role changes
  // ------------------------------------------------------------------
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, preferences: true },
  });

  if (!user) {
    return {
      isAdmin: false,
      userId,
      error: 'User not found',
    };
  }

  // Owner email bypass — owner always has admin access regardless of DB role
  if (isOwnerEmail(user.email)) {
    return { isAdmin: true, userId };
  }

  // Role-based check via preferences JSON field
  const prefs = user.preferences as { role?: string } | null;
  if (prefs?.role !== 'admin' && prefs?.role !== 'superadmin') {
    return {
      isAdmin: false,
      userId,
      error: 'Admin access required',
    };
  }

  return { isAdmin: true, userId };
}
