/**
 * Google Account Linking Route
 *
 * Initiates OAuth flow to link Google to an existing account.
 *
 * @route GET /api/auth/link/google
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - GOOGLE_CLIENT_ID: Google OAuth client ID (CRITICAL)
 * - NEXT_PUBLIC_APP_URL: Application base URL
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns 401 if not authenticated
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import {
  generatePKCEChallenge,
  generateState,
  storePKCEState,
} from '@/lib/auth/pkce';

function getJWTSecret(): string { const s = process.env.JWT_SECRET; if (!s) throw new Error('JWT_SECRET required'); return s; }

const GOOGLE_CONFIG = {
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  clientId: process.env.GOOGLE_CLIENT_ID,
  scope: 'openid email profile',
  responseType: 'code',
  accessType: 'offline',
  prompt: 'consent',
};

export async function GET(request: NextRequest) {
  try {
    // Get and validate auth token
    const token =
      request.cookies.get('auth-token')?.value ||
      request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify token and get user ID
    let userId: string;
    try {
      const decoded = jwt.verify(token, getJWTSecret()) as { sub: string };
      userId = decoded.sub;
    } catch {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Validate Google OAuth is configured
    if (!GOOGLE_CONFIG.clientId) {
      return NextResponse.json(
        { error: 'Google OAuth not configured' },
        { status: 500 }
      );
    }

    // Generate PKCE challenge
    const pkce = generatePKCEChallenge();
    const state = generateState();

    // Build redirect URI
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/auth/oauth/google/callback`;

    // Store PKCE state with linkToUserId to indicate account linking
    await storePKCEState(state, pkce.codeVerifier, 'google', redirectUri, userId);

    // Build Google authorization URL
    const authParams = new URLSearchParams({
      client_id: GOOGLE_CONFIG.clientId,
      redirect_uri: redirectUri,
      response_type: GOOGLE_CONFIG.responseType,
      scope: GOOGLE_CONFIG.scope,
      access_type: GOOGLE_CONFIG.accessType,
      prompt: GOOGLE_CONFIG.prompt,
      state,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: pkce.codeChallengeMethod,
    });

    const authorizationUrl = `${GOOGLE_CONFIG.authUrl}?${authParams.toString()}`;

    return NextResponse.json({
      authorizationUrl,
      message: 'Redirecting to Google to link your account...',
    });
  } catch (error) {
    console.error('[Link Google] Error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate account linking' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
