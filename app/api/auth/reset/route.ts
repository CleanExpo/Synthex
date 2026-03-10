/**
 * Password Reset Execution API
 * Handles actual password reset with token/code
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { emailService } from '@/lib/email/email-service';
import { authStrict } from '@/lib/middleware/api-rate-limit';
import { logger } from '@/lib/logger';

const resetSchema = z.object({
  token: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  email: z.string().email().optional(),
  newPassword: z.string().min(8),
});

// Reset password with token or code
export async function POST(request: NextRequest) {
  // Distributed rate limiting via Upstash Redis
  return authStrict(request, async () => {
  try {
    const body = await request.json();
    const validation = resetSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { token, code, email, newPassword } = validation.data;

    let result;

    if (token) {
      // Reset with token
      result = await emailService.resetPasswordWithToken(token, newPassword);
    } else if (code && email) {
      // Reset with OTP code
      result = await emailService.resetPasswordWithCode(email, code, newPassword);
    } else {
      return NextResponse.json(
        { error: 'Token or code with email is required' },
        { status: 400 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message
    });
  } catch (error: unknown) {
    logger.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
  });
}

// Validate reset token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Validate token
    const validation = await emailService.validateResetToken(token);

    if (!validation.valid) {
      return NextResponse.json(
        { valid: false, message: 'Invalid or expired token' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      message: 'Token is valid'
    });
  } catch (error: unknown) {
    logger.error('Token validation error:', error);
    return NextResponse.json(
      { error: 'Failed to validate token' },
      { status: 500 }
    );
  }
}