/**
 * Unified Login Route
 * ALL login requests go through this single endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { signInFlow } from '@/lib/auth/signInFlow';

const unifiedLoginSchema = z.object({
  method: z.enum(['email', 'oauth']),
  email: z.string().email().optional(),
  password: z.string().optional(),
  provider: z.enum(['google', 'github']).optional(),
  oauthUser: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().nullish(),
    image: z.string().nullish(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = unifiedLoginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { method, email, password, provider, oauthUser } = validation.data;

    // Process through centralized auth flow
    const result = await signInFlow.authenticate(method, {
      email,
      password,
      provider,
      oauthUser
    });

    if (result.success && result.session) {
      // Set secure cookie for session
      const response = NextResponse.json({
        success: true,
        user: result.session.user,
        session: {
          accessToken: result.session.accessToken,
          expiresAt: result.session.expiresAt
        },
        requiresVerification: result.requiresVerification
      });

      // Set HTTP-only cookie for security
      response.cookies.set('auth-token', result.session.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/'
      });

      return response;
    }

    return NextResponse.json(
      { 
        success: false,
        error: result.error || 'Authentication failed' 
      },
      { status: 401 }
    );
  } catch (error) {
    console.error('[UNIFIED-LOGIN] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

// Validate session endpoint
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value || 
                  request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    const result = await signInFlow.validateSession(token);

    if (result.success && result.session) {
      return NextResponse.json({
        authenticated: true,
        user: result.session.user,
        expiresAt: result.session.expiresAt
      });
    }

    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
  } catch (error) {
    console.error('[VALIDATE-SESSION] Error:', error);
    return NextResponse.json(
      { authenticated: false },
      { status: 500 }
    );
  }
}