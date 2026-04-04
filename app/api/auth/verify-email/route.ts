/**
 * Email Verification API
 * Handles email verification requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { emailService } from '@/lib/email/email-service';
import { logger } from '@/lib/logger';

const verifyEmailSchema = z.object({
  code: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = verifyEmailSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { code } = validation.data;

    // Verify the email
    const result = await emailService.verifyEmail(code);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      userId: result.userId
    });
  } catch (error: unknown) {
    logger.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify email' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'Verification code is required' },
        { status: 400 }
      );
    }

    // Verify the email
    const result = await emailService.verifyEmail(code);

    if (!result.success) {
      // Redirect to error page
      return NextResponse.redirect(
        new URL(`/auth/verify-email?error=${encodeURIComponent(result.message)}`, request.url)
      );
    }

    // Redirect to success page
    return NextResponse.redirect(
      new URL('/auth/verify-email?success=true', request.url)
    );
  } catch (error: unknown) {
    logger.error('Email verification error:', error);
    return NextResponse.redirect(
      new URL('/auth/verify-email?error=Verification failed', request.url)
    );
  }
}