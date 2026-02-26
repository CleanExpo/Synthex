/**
 * API Key Hard Gate Middleware
 *
 * Blocks AI endpoint access for users who have not configured a valid API key.
 * Returns 402 (Payment Required) with a redirect hint to the onboarding/settings page.
 *
 * BYPASS: Users with preferences.role === 'superadmin' skip this gate.
 *
 * USAGE:
 * ```typescript
 * import { requireApiKey } from '@/lib/middleware/require-api-key';
 *
 * export async function POST(request: NextRequest) {
 *   return requireApiKey(request, async (userId) => {
 *     // ... AI logic here
 *   });
 * }
 * ```
 *
 * @module lib/middleware/require-api-key
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenSafe } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';

/**
 * Check if user has a configured and valid API key.
 *
 * Uses a two-tier check:
 * 1. Fast path: JWT claim `apiKeyConfigured` (no DB query)
 * 2. Slow path: If claim is missing/stale, query DB for active APICredential
 *
 * @param userId The authenticated user's ID
 * @param jwtApiKeyConfigured The JWT claim value (may be undefined for old tokens)
 * @returns true if user has at least one active, valid API credential
 */
async function hasValidApiKey(
  userId: string,
  jwtApiKeyConfigured?: boolean
): Promise<boolean> {
  // Fast path: trust JWT claim if explicitly true
  if (jwtApiKeyConfigured === true) {
    return true;
  }

  // Slow path: check database for any active, valid credential
  try {
    const credential = await prisma.aPICredential.findFirst({
      where: {
        userId,
        isActive: true,
        isValid: true,
        revokedAt: null,
      },
      select: { id: true },
    });

    return !!credential;
  } catch (error) {
    // If table doesn't exist yet, allow access (graceful degradation)
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('P2021')) {
      console.warn('[requireApiKey] api_credentials table not found — allowing access');
      return true;
    }
    console.error('[requireApiKey] DB error:', msg);
    return false;
  }
}

/**
 * Check if user is a superadmin (bypasses all gates)
 */
async function isSuperadmin(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const prefs = user?.preferences as Record<string, unknown> | null;
    return prefs?.role === 'superadmin';
  } catch {
    return false;
  }
}

/**
 * API Key hard gate middleware.
 *
 * Authenticates the request, then checks for a valid API key.
 * Returns 402 if no key is configured, with a JSON body containing
 * the redirect URL for the frontend to handle.
 *
 * @param request The incoming request
 * @param handler The route handler to call if the gate passes. Receives userId.
 * @returns NextResponse
 */
export async function requireApiKey(
  request: NextRequest,
  handler: (userId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  // 1. Authenticate
  const authToken = request.cookies.get('auth-token')?.value;
  if (!authToken) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const payload = verifyTokenSafe(authToken);
  if (!payload?.userId) {
    return NextResponse.json(
      { error: 'Invalid authentication token' },
      { status: 401 }
    );
  }

  const { userId } = payload;

  // 2. Superadmin bypass
  if (await isSuperadmin(userId)) {
    return handler(userId);
  }

  // 3. Check API key
  const hasKey = await hasValidApiKey(userId, payload.apiKeyConfigured);

  if (!hasKey) {
    return NextResponse.json(
      {
        error: 'API key required',
        code: 'API_KEY_REQUIRED',
        message: 'Please configure an AI provider API key to use this feature.',
        redirect: '/onboarding?step=2',
        settingsUrl: '/dashboard/settings?tab=ai-credentials',
      },
      { status: 402 }
    );
  }

  // 4. Gate passed — call handler
  return handler(userId);
}
