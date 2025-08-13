import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/verify
 * Lightweight compatibility endpoint for static pages using auth-check.js.
 * Returns 200 if an Authorization header is present, else 401.
 * For full verification, swap to your preferred auth implementation.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth) {
    return NextResponse.json({ ok: false, error: 'Missing Authorization header' }, { status: 401 });
  }
  // Optionally: parse and validate JWT/Supabase token here.
  return NextResponse.json({ ok: true });
}
