import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenSafe } from '@/lib/auth/jwt-utils';

/**
 * Token Verification Endpoint
 *
 * Lightweight JWT validation — returns validity and userId only.
 * Does NOT load a full session (use /api/auth/session for that).
 *
 * GET  — validates token from auth-token cookie
 * POST — validates token from Authorization header or request body
 */

export async function GET(request: NextRequest) {
  // Extract token from auth-token cookie
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  const payload = verifyTokenSafe(token);

  if (!payload || !payload.userId) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  return NextResponse.json({ valid: true, userId: payload.userId });
}

export async function POST(request: NextRequest) {
  // Try Authorization header first, then request body
  let token: string | null = null;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // If no header token, try request body
  if (!token) {
    try {
      const body = await request.json();
      token = body.token || null;
    } catch {
      // No valid JSON body — fall through
    }
  }

  // Fall back to cookie
  if (!token) {
    token = request.cookies.get('auth-token')?.value || null;
  }

  if (!token) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  const payload = verifyTokenSafe(token);

  if (!payload || !payload.userId) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  return NextResponse.json({ valid: true, userId: payload.userId });
}
