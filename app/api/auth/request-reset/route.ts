/**
 * Password Reset Request API
 * Handles password reset requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email/email-service';

// Request password reset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link'
      });
    }

    // Send password reset email
    await emailService.sendPasswordResetEmail(user.id, user.email, user.name || undefined);

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link'
    });
  } catch (error: any) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}