import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { email as emailService } from '@/lib/email/index';
import { logger } from '@/lib/logger';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    ),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { valid: false, error: 'Missing token' },
      { status: 400 }
    );
  }

  const validation = await emailService.validateResetToken(token);
  return NextResponse.json(
    { valid: validation.valid },
    { status: validation.valid ? 200 : 400 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = resetPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const result = await emailService.resetPassword(
      validation.data.token,
      validation.data.password
    );

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error: unknown) {
    logger.error('[RESET-PASSWORD] Error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password. Please try again.' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
