import { NextResponse } from 'next/server';
import { createAuthClient, serverDb } from '@/lib/supabase-server';
import { z } from 'zod';

// Input validation schema
const loginSchema = z.object({
  email: z.string().email('Invalid email format').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required')
});

// Rate limiting - simple in-memory store for demo (use Redis in production)
const attemptStore = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = attemptStore.get(identifier);
  
  if (!record) {
    attemptStore.set(identifier, { count: 1, lastAttempt: now });
    return { allowed: true };
  }
  
  // Reset if lockout period has passed
  if (now - record.lastAttempt > LOCKOUT_DURATION) {
    attemptStore.set(identifier, { count: 1, lastAttempt: now });
    return { allowed: true };
  }
  
  if (record.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((LOCKOUT_DURATION - (now - record.lastAttempt)) / 1000);
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
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Too many login attempts. Please try again later.',
          retryAfter: rateLimit.retryAfter 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimit.retryAfter?.toString() || '900'
          }
        }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = loginSchema.safeParse(body);
    
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

    const { email, password } = validationResult.data;
    
    // Create Supabase client for auth
    const supabase = createAuthClient();

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('Login error:', authError);
      
      // Log failed attempt
      try {
        await serverDb.audit.log({
          action: 'user_login',
          resource: 'authentication',
          outcome: 'failure',
          category: 'auth',
          severity: 'medium',
          details: {
            email,
            error: authError.message,
            timestamp: new Date().toISOString()
          }
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }

      // Handle specific error cases
      if (authError.message.includes('Invalid login credentials')) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }

      if (authError.message.includes('Email not confirmed')) {
        return NextResponse.json(
          { error: 'Please verify your email before logging in' },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { error: authError.message || 'Failed to sign in' },
        { status: 400 }
      );
    }

    if (!authData.user || !authData.session) {
      return NextResponse.json(
        { error: 'Failed to authenticate user' },
        { status: 500 }
      );
    }

    // Log successful login
    try {
      await serverDb.audit.log({
        user_id: authData.user.id,
        action: 'user_login',
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
      console.error('Database error during login:', dbError);
      // Continue even if audit log fails
    }

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: authData.user.user_metadata?.name || authData.user.email?.split('@')[0],
        emailVerified: !!authData.user.email_confirmed_at,
        lastSignIn: authData.user.last_sign_in_at
      },
      message: 'Successfully logged in',
      redirectTo: '/dashboard'
    });

    // Enhanced cookie security configuration
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
      // Add additional security for production
      ...(isProduction && {
        domain: process.env.COOKIE_DOMAIN || undefined,
        priority: 'high' as const
      })
    };

    // Set session cookies with enhanced security
    response.cookies.set('supabase-auth-token', authData.session.access_token, {
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Set refresh token with longer expiry
    response.cookies.set('supabase-refresh-token', authData.session.refresh_token, {
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // Set user ID cookie for client-side access (non-httpOnly for client access)
    response.cookies.set('user-id', authData.user.id, {
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
      ...(isProduction && {
        domain: process.env.COOKIE_DOMAIN || undefined
      })
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    
    // Log the error
    try {
      await serverDb.audit.log({
        action: 'user_login',
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

// Logout endpoint
export async function DELETE(request: Request) {
  try {
    const supabase = createAuthClient();
    
    // Get user ID from cookie for audit logging
    const cookieStore = request.headers.get('cookie');
    const userIdMatch = cookieStore?.match(/user-id=([^;]+)/);
    const userId = userIdMatch ? userIdMatch[1] : null;
    
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Logout error:', error);
    }

    // Log successful logout
    if (userId) {
      try {
        await serverDb.audit.log({
          user_id: userId,
          action: 'user_logout',
          resource: 'authentication',
          resource_id: userId,
          outcome: 'success',
          category: 'auth',
          details: {
            timestamp: new Date().toISOString()
          }
        });
      } catch (logError) {
        console.error('Failed to log logout:', logError);
      }
    }

    // Clear all auth cookies with proper security settings
    const response = NextResponse.json({
      success: true,
      message: 'Successfully logged out'
    });

    const isProduction = process.env.NODE_ENV === 'production';
    const clearCookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 0, // Expire immediately
      ...(isProduction && {
        domain: process.env.COOKIE_DOMAIN || undefined
      })
    };

    response.cookies.set('supabase-auth-token', '', clearCookieOptions);
    response.cookies.set('supabase-refresh-token', '', clearCookieOptions);
    response.cookies.set('user-id', '', {
      ...clearCookieOptions,
      httpOnly: false // Match original setting
    });

    return response;
  } catch (error: any) {
    console.error('Logout error:', error);
    
    return NextResponse.json(
      { error: 'Failed to logout. Please try again.' },
      { status: 500 }
    );
  }
}