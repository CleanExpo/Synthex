/**
 * Change Password API Route
 * POST /api/user/change-password - Change user password
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anon key (PUBLIC)
 *
 * SECURITY: Requires authentication via Supabase token
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { z } from 'zod';
import { mutation } from '@/lib/middleware/api-rate-limit';
import { logger } from '@/lib/logger';

// Validation schema for password change
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export async function POST(request: NextRequest) {
  // Distributed rate limiting via Upstash Redis
  return mutation(request, async () => {
  try {
    // Auth check - require authorization header with Supabase token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const validationResult = changePasswordSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validationResult.data;

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email || '',
      password: currentPassword,
    });

    if (signInError) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      logger.error('Password update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Change password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
  });
}
