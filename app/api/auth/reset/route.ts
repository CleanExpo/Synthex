/**
 * Password Reset Execution API
 * Handles actual password reset with token/code
 */

import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email/email-service';

// Reset password with token or code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, code, email, newPassword } = body;

    if (!newPassword) {
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

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
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
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
    console.error('Token validation error:', error);
    return NextResponse.json(
      { error: 'Failed to validate token' },
      { status: 500 }
    );
  }
}