import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth/jwt-utils';
import { z } from 'zod';
import { authStrict } from '@/lib/middleware/api-rate-limit';
import { logger } from '@/lib/logger';
import { email as emailService } from '@/lib/email/index';

// Input validation schema
const signupSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .optional(),
  email: z.string().email('Invalid email format').min(1, 'Email is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    ),
  timezone: z.string().max(100).optional(),
  inviteCode: z.string().min(1).max(20).trim().toUpperCase().optional(),
});

// SYN-697: 1 MB payload limit
const MAX_PAYLOAD_BYTES = 1 * 1024 * 1024;

export async function POST(request: NextRequest) {
  // Distributed rate limiting via Upstash Redis (replaces in-memory Map)
  return authStrict(request, async () => {
    try {
      // SYN-697: reject oversized payloads
      const contentLength = request.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
        return NextResponse.json(
          { error: 'Payload too large' },
          { status: 413 }
        );
      }

      // Parse and validate request body
      const body = await request.json();

      // SYN-697: secondary guard when content-length header was absent
      const bodySize = Buffer.byteLength(JSON.stringify(body));
      if (bodySize > MAX_PAYLOAD_BYTES) {
        return NextResponse.json(
          { error: 'Payload too large' },
          { status: 413 }
        );
      }
      const validationResult = signupSchema.safeParse(body);

      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: 'Invalid input',
            details: validationResult.error.issues.map(issue => ({
              field: issue.path.join('.'),
              message: issue.message,
            })),
          },
          { status: 400 }
        );
      }

      const { name, email, password, timezone, inviteCode } =
        validationResult.data;

      // Invite codes are optional. If one is supplied, it must be valid
      // (exists, active, not expired, not maxed out, email match).
      let validatedInvite: { id: string; code: string } | null = null;

      if (inviteCode) {
        const invite = await prisma.inviteCode.findUnique({
          where: { code: inviteCode },
        });

        if (!invite) {
          return NextResponse.json(
            { error: 'Invalid invite code.' },
            { status: 400 }
          );
        }

        if (!invite.isActive) {
          return NextResponse.json(
            { error: 'This invite code has been deactivated.' },
            { status: 400 }
          );
        }

        if (invite.expiresAt && invite.expiresAt < new Date()) {
          return NextResponse.json(
            { error: 'This invite code has expired.' },
            { status: 400 }
          );
        }

        if (invite.useCount >= invite.maxUses) {
          return NextResponse.json(
            { error: 'This invite code has already been used.' },
            { status: 400 }
          );
        }

        // If invite is locked to a specific email, enforce the match
        if (
          invite.email &&
          invite.email.toLowerCase() !== email.toLowerCase()
        ) {
          return NextResponse.json(
            {
              error:
                'This invite code is reserved for a different email address.',
            },
            { status: 400 }
          );
        }

        validatedInvite = { id: invite.id, code: invite.code };
      }

      const existingByEmail = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      });

      // SYN-696: keep the duplicate-email response generic.
      if (existingByEmail) {
        return NextResponse.json(
          { error: 'Registration failed' },
          { status: 400 }
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      try {
        const createdUser = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            name: name || email.split('@')[0],
            authProvider: 'email',
            conversionCopyVariant: Math.random() < 0.5 ? 'win' : 'control',
            emailVerified: false,
            ...(timezone && { timezone }),
          },
        });

        // Mark invite code as used (if invite-only mode)
        if (validatedInvite) {
          try {
            await prisma.inviteCode.update({
              where: { id: validatedInvite.id },
              data: {
                useCount: { increment: 1 },
                usedBy: createdUser.id,
                usedAt: new Date(),
              },
            });
          } catch (inviteError) {
            logger.error(
              '[SIGNUP] Failed to mark invite code as used:',
              inviteError
            );
            // Non-blocking — user already created, don't fail the signup
          }
        }

        await prisma.auditLog.create({
          data: {
            userId: createdUser.id,
            action: 'user_signup',
            resource: 'authentication',
            resourceId: createdUser.id,
            outcome: 'success',
            category: 'auth',
            details: {
              email,
              provider: 'email',
              inviteCode: validatedInvite?.code || undefined,
              timestamp: new Date().toISOString(),
            },
          },
        });

        emailService
          .sendVerificationEmail(
            createdUser.id,
            createdUser.email,
            createdUser.name || undefined
          )
          .catch((err: unknown) => {
            logger.error(
              '[SIGNUP] Verification email failed (non-blocking):',
              err
            );
          });

        emailService
          .sendWelcomeEmail(
            createdUser.email,
            createdUser.name || email.split('@')[0]
          )
          .catch((err: unknown) => {
            logger.error('[SIGNUP] Welcome email failed (non-blocking):', err);
          });
        // Set auth cookie for immediate login
        const response = NextResponse.json({
          success: true,
          user: {
            id: createdUser.id,
            email: createdUser.email,
            name: createdUser.name,
          },
          message:
            'Account created successfully. Please check your email to verify your account.',
          requiresVerification: true,
        });

        // Generate JWT auth-token (for middleware onboarding check)
        const jwtToken = generateToken({
          userId: createdUser.id,
          email: createdUser.email,
          onboardingComplete: false,
          apiKeyConfigured: false,
        });

        const isProduction = process.env.NODE_ENV === 'production';
        const cookieOptions = {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax' as const,
          path: '/',
          ...(isProduction && {
            domain: process.env.COOKIE_DOMAIN || undefined,
            priority: 'high' as const,
          }),
        };

        response.cookies.set('auth-token', jwtToken, {
          ...cookieOptions,
          maxAge: 60 * 60 * 24 * 7,
        });

        response.cookies.set('user-id', createdUser.id, {
          secure: isProduction,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
          ...(isProduction && {
            domain: process.env.COOKIE_DOMAIN || undefined,
          }),
        });

        return response;
      } catch (dbError) {
        logger.error('[SIGNUP] Database error during signup:', dbError);
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        );
      }
    } catch (error: unknown) {
      logger.error('Signup error:', error);

      // Log the error
      try {
        await prisma.auditLog.create({
          data: {
            action: 'user_signup',
            resource: 'authentication',
            outcome: 'failure',
            category: 'auth',
            severity: 'high',
            details: {
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (logError) {
        logger.error('Failed to log error:', logError);
      }

      return NextResponse.json(
        { error: 'An unexpected error occurred. Please try again.' },
        { status: 500 }
      );
    }
  });
}

export const runtime = 'nodejs';
