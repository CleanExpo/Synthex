/**
 * API Key Hard Gate — Edge Runtime Safe
 *
 * This module contains only the Edge-compatible gate check for /api/ai/* routes.
 * It uses JWT payload decoding without any Node.js APIs (no Prisma, no jsonwebtoken).
 *
 * It is intentionally kept free of all Node.js-only imports so it can be safely
 * imported from middleware.ts which runs on the Edge Runtime.
 *
 * For the full DB-backed gate used inside route handlers (Node.js runtime), see:
 * lib/middleware/require-api-key.ts → requireApiKey()
 *
 * @module lib/middleware/api-key-gate.edge
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Decode a JWT payload without verifying the signature.
 *
 * This is intentionally "unsafe" (no verification) because:
 * 1. The Edge Runtime cannot run jsonwebtoken (Node.js crypto dependency)
 * 2. Signature verification is performed by verifyTokenSafe() inside each route handler
 * 3. A forged token claiming apiKeyConfigured=true would pass this gate and then be
 *    rejected by the route handler's full verification — defense-in-depth is preserved
 *
 * Returns null if the token cannot be decoded.
 */
function decodeJWTPayloadUnsafe(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Edge-safe hard gate for /api/ai/* routes.
 *
 * Reads the `auth-token` cookie, decodes the JWT payload (no signature
 * verification — that is handled by each route handler), and blocks the
 * request with 403 if `apiKeyConfigured` is explicitly `false`.
 *
 * Allows the request through (returns null) when:
 *  - No auth-token cookie is present  → route handler will return 401
 *  - Token cannot be decoded          → graceful degradation, allow through
 *  - `apiKeyConfigured` is true       → user has a key, allow through
 *  - `apiKeyConfigured` is undefined  → older token without the claim, allow through
 *  - `role` is 'superadmin'           → superadmin bypass
 *
 * @param request The incoming NextRequest from middleware
 * @returns NextResponse (403) to short-circuit, or null to continue
 */
export function checkApiKeyGate(request: NextRequest): NextResponse | null {
  const authToken = request.cookies.get('auth-token')?.value;

  // No token — pass through and let the route handler return 401
  if (!authToken) {
    return null;
  }

  const payload = decodeJWTPayloadUnsafe(authToken);

  // Could not decode — allow through (graceful degradation)
  if (!payload) {
    return null;
  }

  // Superadmin bypass
  if (payload.role === 'superadmin') {
    return null;
  }

  // Only block when the claim is explicitly false.
  // undefined / missing means an older token without the claim — allow through
  // for backwards compatibility so existing sessions are not disrupted.
  if (payload.apiKeyConfigured === false) {
    return NextResponse.json(
      {
        error: 'API key required',
        code: 'API_KEY_NOT_CONFIGURED',
        message: 'Please configure an AI provider API key to use AI features.',
        redirect: '/onboarding?step=2',
        settingsUrl: '/dashboard/settings?tab=ai-credentials',
      },
      { status: 403 }
    );
  }

  return null;
}
