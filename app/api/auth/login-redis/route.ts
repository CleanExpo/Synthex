import { NextResponse } from 'next/server';
import { createAuthClient, serverDb } from '@/lib/supabase-server';
import { z } from 'zod';
import { 
  checkRateLimit, 
  createSession, 
  deleteSession,
  set,
  get 
} from '@/src/lib/redis-unified';

// Input validation schema
const loginSchema = z.object({
  email: z.string().email('Invalid email format').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required')
});

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  prefix: 'login'
};

export async function POST(request: Request) {
  try {
    // Get client IP for rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    
    // Check rate limiting using Redis
    const rateLimitKey = `${RATE_LIMIT_CONFIG.prefix}:${clientIp}`;
    const rateLimit = await checkRateLimit(
      rateLimitKey, 
      RATE_LIMIT_CONFIG.maxAttempts, 
      RATE_LIMIT_CONFIG.windowMs
    );
    
    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      
      // Log rate limit exceeded
      console.warn(`Rate limit exceeded for IP: ${clientIp}`);
      
      return NextResponse.json(
        { 
          error: 'Too many login attempts. Please try again later.',
          retryAfter 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': Math.max(0, rateLimit.limit - rateLimit.count).toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString()
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
      
      // Cache failed attempt information in Redis for security monitoring
      const failedAttemptKey = `failed_login:${email}`;
      const failedAttempts = await get(failedAttemptKey) || 0;
      await set(failedAttemptKey, failedAttempts + 1, 3600); // Track for 1 hour
      
      // Log failed attempt
      try {
        await serverDb.audit.log({
          action: 'user_login',
          resource: 'authentication',
          outcome: 'failure',
          category: 'auth',
          severity: failedAttempts > 3 ? 'high' : 'medium',
          details: {
            email,
            error: authError.message,
            failedAttempts: failedAttempts + 1,
            clientIp,
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

    // Clear failed attempts on successful login
    await set(`failed_login:${email}`, 0, 1);
    
    // Create Redis session for additional session management
    const redisSessionId = await createSession(authData.user.id, {
      email: authData.user.email,
      provider: 'email',
      supabaseSessionId: authData.session.access_token,
      loginTime: new Date().toISOString(),
      clientIp,
      userAgent: request.headers.get('user-agent') || 'unknown'
    }, 60 * 60 * 24 * 7); // 7 days TTL
    
    // Cache user profile data for quick access
    await set(`user_profile:${authData.user.id}`, {
      id: authData.user.id,
      email: authData.user.email,
      name: authData.user.user_metadata?.name || authData.user.email?.split('@')[0],
      emailVerified: !!authData.user.email_confirmed_at,
      lastSignIn: new Date().toISOString()
    }, 60 * 60 * 24); // Cache for 24 hours

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
          redisSessionId,
          clientIp,
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
      sessionId: redisSessionId,
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
    
    // Set Redis session ID cookie for session management
    response.cookies.set('redis-session-id', redisSessionId, {
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * 7, // 7 days
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
    
    // Get session IDs from cookies
    const cookieStore = request.headers.get('cookie');
    const userIdMatch = cookieStore?.match(/user-id=([^;]+)/);
    const redisSessionMatch = cookieStore?.match(/redis-session-id=([^;]+)/);
    
    const userId = userIdMatch ? userIdMatch[1] : null;
    const redisSessionId = redisSessionMatch ? redisSessionMatch[1] : null;
    
    // Delete Redis session if exists
    if (redisSessionId) {
      await deleteSession(redisSessionId);
    }
    
    // Clear cached user profile
    if (userId) {
      await set(`user_profile:${userId}`, null, 1);
    }
    
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
            redisSessionId,
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
    response.cookies.set('redis-session-id', '', clearCookieOptions);
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