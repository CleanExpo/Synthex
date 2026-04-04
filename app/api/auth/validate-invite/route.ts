/**
 * Invite Code Validation API
 *
 * POST /api/auth/validate-invite
 *
 * Public endpoint that validates an invite code before signup.
 * Returns whether the code is valid and any associated email restriction.
 *
 * Rate-limited to prevent brute-force enumeration.
 *
 * @module app/api/auth/validate-invite/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { authStrict } from '@/lib/middleware/api-rate-limit';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const validateSchema = z.object({
  code: z.string().min(1, 'Invite code is required').max(20).trim().toUpperCase(),
  email: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  return authStrict(request, async () => {
    try {
      const body = await request.json();
      const validation = validateSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { valid: false, error: 'Invalid input' },
          { status: 400 }
        );
      }

      const { code, email } = validation.data;

      const invite = await prisma.inviteCode.findUnique({
        where: { code },
      });

      if (!invite) {
        return NextResponse.json({ valid: false, error: 'Invalid invite code' });
      }

      // Check if active
      if (!invite.isActive) {
        return NextResponse.json({ valid: false, error: 'This invite code has been deactivated' });
      }

      // Check if expired
      if (invite.expiresAt && invite.expiresAt < new Date()) {
        return NextResponse.json({ valid: false, error: 'This invite code has expired' });
      }

      // Check if max uses reached
      if (invite.useCount >= invite.maxUses) {
        return NextResponse.json({ valid: false, error: 'This invite code has already been used' });
      }

      // Check email restriction
      if (invite.email && email && invite.email.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json({ valid: false, error: 'This invite code is reserved for a different email' });
      }

      return NextResponse.json({
        valid: true,
        email: invite.email || undefined,
      });
    } catch (error) {
      logger.error('POST /api/auth/validate-invite error:', error);
      return NextResponse.json(
        { valid: false, error: 'Validation failed' },
        { status: 500 }
      );
    }
  });
}
