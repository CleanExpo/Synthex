/**
 * Password Reset Request API
 * Handles password reset requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email/email-service';
import { authStrict } from '@/lib/middleware/api-rate-limit';

const requestResetSchema = z.object({
  email: z.string().email(),
});

// Request password reset
export async function POST(request: NextRequest) {
  // Distributed rate limiting via Upstash Redis
  return authStrict(request, async () => {
  try {
    const body = await request.json();
    const validation = requestResetSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { email } = validation.data;

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
  } catch (error: unknown) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
  });
}

export const runtime = 'nodejs';