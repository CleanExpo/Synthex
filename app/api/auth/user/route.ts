/**
 * User Authentication Status Endpoint
 * Returns current authenticated user or 401 if not authenticated
 */

import { NextRequest, NextResponse } from 'next/server';
import { signInFlow } from '@/src/lib/auth/signInFlow';

export async function GET(request: NextRequest) {
  try {
    // Get token from cookie or Authorization header
    const token = request.cookies.get('auth-token')?.value || 
                  request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { 
          authenticated: false,
          error: 'No authentication token found' 
        },
        { status: 401 }
      );
    }

    // Validate the session using the centralized auth flow
    const result = await signInFlow.validateSession(token);

    if (result.success && result.session) {
      return NextResponse.json({
        authenticated: true,
        user: result.session.user,
        expiresAt: result.session.expiresAt
      });
    }

    // If no valid session, check for demo mode
    if (!result.success) {
      // Allow demo user access without full authentication
      const isDemoMode = process.env.DEMO_MODE === 'true' || !process.env.SUPABASE_URL;
      
      if (isDemoMode) {
        return NextResponse.json({
          authenticated: true,
          user: {
            id: 'demo-user-001',
            email: 'demo@synthex.com',
            name: 'Demo User',
            provider: 'demo',
            emailVerified: true
          },
          expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 1 day
          demoMode: true
        });
      }
    }

    return NextResponse.json(
      { 
        authenticated: false,
        error: result.error || 'Session invalid or expired'
      },
      { status: 401 }
    );
  } catch (error) {
    console.error('[AUTH/USER] Error:', error);
    
    // In development, return demo user to prevent blocking
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        authenticated: true,
        user: {
          id: 'demo-user-001',
          email: 'demo@synthex.com',
          name: 'Demo User',
          provider: 'demo',
          emailVerified: true
        },
        expiresAt: Date.now() + (24 * 60 * 60 * 1000),
        demoMode: true,
        warning: 'Authentication service error - using demo mode'
      });
    }
    
    return NextResponse.json(
      { 
        authenticated: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * Update user profile
 */
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value || 
                  request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const result = await signInFlow.validateSession(token);

    if (!result.success || !result.session) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, avatar } = body;

    // In demo mode, just return success
    if (result.session.user.provider === 'demo') {
      return NextResponse.json({
        success: true,
        user: {
          ...result.session.user,
          name: name || result.session.user.name,
          avatar: avatar || result.session.user.avatar
        }
      });
    }

    // TODO: Implement actual profile update in database
    // For now, return the updated user object
    return NextResponse.json({
      success: true,
      user: {
        ...result.session.user,
        name: name || result.session.user.name,
        avatar: avatar || result.session.user.avatar
      }
    });
  } catch (error) {
    console.error('[AUTH/USER] Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

/**
 * Delete user account (soft delete)
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value || 
                  request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const result = await signInFlow.validateSession(token);

    if (!result.success || !result.session) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Sign out the user
    await signInFlow.signOut(token);

    // Clear the auth cookie
    const response = NextResponse.json({
      success: true,
      message: 'Account deleted successfully'
    });

    response.cookies.delete('auth-token');

    return response;
  } catch (error) {
    console.error('[AUTH/USER] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}