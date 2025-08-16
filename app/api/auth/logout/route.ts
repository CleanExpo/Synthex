/**
 * Logout Endpoint
 * Destroys the user session and clears authentication cookies
 */

import { NextRequest, NextResponse } from 'next/server';
import { signInFlow } from '@/src/lib/auth/signInFlow';

export async function POST(request: NextRequest) {
  try {
    // Get token from cookie or Authorization header
    const token = request.cookies.get('auth-token')?.value || 
                  request.headers.get('Authorization')?.replace('Bearer ', '');

    // Sign out even if no token (clear any residual state)
    if (token) {
      try {
        await signInFlow.signOut(token);
      } catch (error) {
        console.warn('[LOGOUT] Error signing out:', error);
        // Continue with logout even if signOut fails
      }
    }

    // Clear the auth cookie
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

    // Delete all auth-related cookies
    response.cookies.delete('auth-token');
    response.cookies.delete('synthex-auth-token');
    
    // Set cookies to expire immediately as a fallback
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    });

    response.cookies.set('synthex-auth-token', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('[LOGOUT] Error:', error);
    
    // Even on error, clear cookies
    const response = NextResponse.json(
      { 
        success: false,
        error: 'Logout failed, but session cleared',
        message: 'You have been logged out'
      },
      { status: 200 } // Return 200 even on error to ensure logout
    );

    response.cookies.delete('auth-token');
    response.cookies.delete('synthex-auth-token');

    return response;
  }
}

/**
 * GET endpoint for logout (useful for link-based logouts)
 */
export async function GET(request: NextRequest) {
  return POST(request);
}