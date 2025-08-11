import { NextResponse } from 'next/server';

// Development login endpoint - DISABLED for security
export async function POST(request: Request) {
  // This endpoint is completely disabled to prevent security issues
  // All authentication must go through the real auth flow
  return NextResponse.json({ 
    error: 'Dev login is disabled. Please use /api/auth/login for authentication.',
    redirect: '/login'
  }, { status: 403 });
}