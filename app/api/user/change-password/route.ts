/**
 * Change Password API Route
 * POST /api/user/change-password - Change user password
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - LEGACY_PLATFORM_URL: Supabase URL (PUBLIC)
 * - LEGACY_PLATFORM_ANON_KEY: Supabase anon key (PUBLIC)
 *
 * SECURITY: Requires authentication via Supabase token
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { mutation } from '@/lib/middleware/api-rate-limit';
import { logger } from '@/lib/logger';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';

// Validation schema for password change
const changePasswordSchema = z
  .object({
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
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export async function POST(request: NextRequest) {
  // Distributed rate limiting via Upstash Redis
  return mutation(request, async () => {
    try {
      const userId = await getUserIdFromRequestOrCookies(request);
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      });

      if (!user?.password) {
        return NextResponse.json(
          { error: 'Password sign-in is not available for this account' },
          { status: 400 }
        );
      }

      const currentPasswordMatches = await bcrypt.compare(
        currentPassword,
        user.password
      );

      if (!currentPasswordMatches) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        );
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

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
