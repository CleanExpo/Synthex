import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, serverDb } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth/jwt-utils';
import { z } from 'zod';
import { authStrict } from '@/lib/middleware/api-rate-limit';
import { logger } from '@/lib/logger';

// Input validation schema
const signupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  email: z.string().email('Invalid email format').min(1, 'Email is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  timezone: z.string().max(100).optional(),
  inviteCode: z.string().min(1).max(20).trim().toUpperCase().optional(),
});

const isInviteOnly = process.env.NEXT_PUBLIC_INVITE_ONLY_MODE === 'true';

export async function POST(request: NextRequest) {
  // Distributed rate limiting via Upstash Redis (replaces in-memory Map)
  return authStrict(request, async () => {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = signupSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input', 
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    const { name, email, password, timezone, inviteCode } = validationResult.data;

    // ── Invite-only gate ──────────────────────────────────────────────
    // When NEXT_PUBLIC_INVITE_ONLY_MODE=true, require a valid invite code.
    // Validates: exists, active, not expired, not maxed out, email match.
    let validatedInvite: { id: string; code: string } | null = null;

    if (isInviteOnly) {
      if (!inviteCode) {
        return NextResponse.json(
          { error: 'An invite code is required to sign up during early access.' },
          { status: 400 }
        );
      }

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
      if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json(
          { error: 'This invite code is reserved for a different email address.' },
          { status: 400 }
        );
      }

      validatedInvite = { id: invite.id, code: invite.code };
    }

    const supabase = createAuthClient();

    // Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '')}/onboarding`
      }
    });

    if (authError) {
      logger.error('Signup error:', authError);
      
      // Handle specific error cases
      if (authError.message.includes('already registered')) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: authError.message || 'Failed to create account' },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      );
    }

    // Create user record in Prisma database (CRITICAL - this was missing!)
    try {
      // Check if user already exists in Prisma (edge case - Supabase has user but Prisma doesn't)
      const existingPrismaUser = await prisma.user.findUnique({
        where: { id: authData.user.id }
      });

      if (!existingPrismaUser) {
        // Also check by email in case of ID mismatch
        const existingByEmail = await prisma.user.findUnique({
          where: { email: authData.user.email! }
        });

        if (!existingByEmail) {
          await prisma.user.create({
            data: {
              id: authData.user.id,
              email: authData.user.email!,
              name: name || authData.user.user_metadata?.name || email.split('@')[0],
              authProvider: 'email',
              // Database expects DateTime for emailVerified, not boolean
              // null = not yet verified, will be set to Date when verified
              emailVerified: null,
              // Auto-detect timezone from browser (falls back to schema default)
              ...(timezone && { timezone }),
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          });
        }
      }

      // Mark invite code as used (if invite-only mode)
      if (validatedInvite) {
        try {
          await prisma.inviteCode.update({
            where: { id: validatedInvite.id },
            data: {
              useCount: { increment: 1 },
              usedBy: authData.user.id,
              usedAt: new Date(),
            },
          });
        } catch (inviteError) {
          logger.error('[SIGNUP] Failed to mark invite code as used:', inviteError);
          // Non-blocking — user already created, don't fail the signup
        }
      }

      // Log signup action to audit
      await serverDb.audit.log({
        user_id: authData.user.id,
        action: 'user_signup',
        resource: 'authentication',
        resource_id: authData.user.id,
        outcome: 'success',
        category: 'auth',
        details: {
          email,
          provider: 'email',
          inviteCode: validatedInvite?.code || undefined,
          timestamp: new Date().toISOString()
        }
      });
    } catch (dbError) {
      logger.error('[SIGNUP] Database error during signup:', dbError);
      // Don't fail signup if Prisma fails - user can still use Supabase Auth
      // But log the error for debugging
    }

    // Set auth cookie for immediate login
    const response = NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: authData.user.user_metadata?.name || name
      },
      message: 'Account created successfully! Please check your email to verify your account.',
      requiresVerification: !authData.user.email_confirmed_at
    });

    // Generate JWT auth-token (for middleware onboarding check)
    const jwtToken = generateToken({
      userId: authData.user.id,
      email: authData.user.email!,
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
        priority: 'high' as const
      })
    };

    // Set auth-token JWT cookie (primary auth for middleware + API routes)
    response.cookies.set('auth-token', jwtToken, {
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Set session cookie if we have a session (enhanced security)
    if (authData.session) {
      response.cookies.set('supabase-auth-token', authData.session.access_token, {
        ...cookieOptions,
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      // Also set refresh token
      response.cookies.set('supabase-refresh-token', authData.session.refresh_token || '', {
        ...cookieOptions,
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      // Set user ID cookie for client-side access
      response.cookies.set('user-id', authData.user.id, {
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
        ...(isProduction && {
          domain: process.env.COOKIE_DOMAIN || undefined
        })
      });
    }

    return response;
  } catch (error: unknown) {
    logger.error('Signup error:', error);
    
    // Log the error
    try {
      await serverDb.audit.log({
        action: 'user_signup',
        resource: 'authentication',
        outcome: 'failure',
        category: 'auth',
        severity: 'high',
        details: {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }
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