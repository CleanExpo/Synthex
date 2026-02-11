import { NextResponse } from 'next/server';
import { createAuthClient, serverDb } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Input validation schema
const signupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  email: z.string().email('Invalid email format').min(1, 'Email is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number')
});

// Rate limiting for signup attempts
const signupAttemptStore = new Map<string, { count: number; lastAttempt: number }>();
const MAX_SIGNUP_ATTEMPTS = 3;
const SIGNUP_LOCKOUT_DURATION = 60 * 60 * 1000; // 1 hour

function checkSignupRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = signupAttemptStore.get(identifier);
  
  if (!record) {
    signupAttemptStore.set(identifier, { count: 1, lastAttempt: now });
    return { allowed: true };
  }
  
  // Reset if lockout period has passed
  if (now - record.lastAttempt > SIGNUP_LOCKOUT_DURATION) {
    signupAttemptStore.set(identifier, { count: 1, lastAttempt: now });
    return { allowed: true };
  }
  
  if (record.count >= MAX_SIGNUP_ATTEMPTS) {
    const retryAfter = Math.ceil((SIGNUP_LOCKOUT_DURATION - (now - record.lastAttempt)) / 1000);
    return { allowed: false, retryAfter };
  }
  
  record.count++;
  record.lastAttempt = now;
  return { allowed: true };
}

export async function POST(request: Request) {
  try {
    // Get client IP for rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    
    // Check rate limiting
    const rateLimit = checkSignupRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Too many signup attempts. Please try again later.',
          retryAfter: rateLimit.retryAfter 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimit.retryAfter?.toString() || '3600'
          }
        }
      );
    }

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

    const { name, email, password } = validationResult.data;

    const supabase = createAuthClient();

    // Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '')}/dashboard`
      }
    });

    if (authError) {
      console.error('Signup error:', authError);
      
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
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          });
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
          timestamp: new Date().toISOString()
        }
      });
    } catch (dbError) {
      console.error('[SIGNUP] Database error during signup:', dbError);
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

    // Set session cookie if we have a session (enhanced security)
    if (authData.session) {
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
  } catch (error: any) {
    console.error('Signup error:', error);
    
    // Log the error
    try {
      await serverDb.audit.log({
        action: 'user_signup',
        resource: 'authentication',
        outcome: 'failure',
        category: 'auth',
        severity: 'high',
        details: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}