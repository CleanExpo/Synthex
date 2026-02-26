/**
 * Resend Email Verification API
 *
 * Resends the verification email to the authenticated user via Supabase Auth.
 * Rate-limited to prevent abuse (authStrict — 5 req/min).
 *
 * Route: POST /api/auth/resend-verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/lib/supabase-server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { authStrict } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  return authStrict(request, async () => {
    try {
      // Authenticate via JWT cookie
      const userId = await getUserIdFromRequestOrCookies(request);
      if (!userId) {
        return NextResponse.json(
          { error: 'Not authenticated. Please log in and try again.' },
          { status: 401 }
        );
      }

      // Look up user email from Prisma
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, emailVerified: true },
      });

      if (!user?.email) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // If already verified, no need to resend
      if (user.emailVerified) {
        return NextResponse.json(
          { error: 'Email is already verified' },
          { status: 400 }
        );
      }

      // Resend verification email via Supabase Auth
      const supabase = createAuthClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });

      if (error) {
        console.error('[RESEND-VERIFICATION] Supabase error:', error.message);
        return NextResponse.json(
          { error: error.message || 'Failed to resend verification email' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Verification email sent. Please check your inbox.',
      });
    } catch (error: unknown) {
      console.error('[RESEND-VERIFICATION] Error:', error);
      return NextResponse.json(
        { error: 'Failed to resend verification email. Please try again.' },
        { status: 500 }
      );
    }
  });
}

export const runtime = 'nodejs';
