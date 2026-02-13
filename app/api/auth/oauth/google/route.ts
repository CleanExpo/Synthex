/**
 * Google OAuth Initiation Route
 *
 * Initiates the OAuth 2.0 authorization code flow with PKCE
 * for secure authentication with Google.
 *
 * @route GET /api/auth/oauth/google
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - GOOGLE_CLIENT_ID: Google OAuth client ID (CRITICAL)
 * - NEXT_PUBLIC_APP_URL: Application base URL for redirects
 *
 * FAILURE MODE: Returns 500 if Google OAuth not configured
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generatePKCEChallenge,
  generateState,
  storePKCEState,
} from '@/lib/auth/pkce';

// Google OAuth configuration
const GOOGLE_CONFIG = {
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  clientId: process.env.GOOGLE_CLIENT_ID,
  scope: 'openid email profile',
  responseType: 'code',
  accessType: 'offline',
  prompt: 'consent', // Force consent to get refresh token
};

export async function GET(request: NextRequest) {
  try {
    // Validate Google OAuth is configured
    if (!GOOGLE_CONFIG.clientId) {
      return NextResponse.json(
        {
          error: 'Google OAuth not configured',
          message: 'Please add GOOGLE_CLIENT_ID to environment variables',
        },
        { status: 500 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const linkToUserId = searchParams.get('linkToUserId'); // For account linking
    const returnTo = searchParams.get('returnTo') || '/dashboard';

    // Generate PKCE challenge
    const pkce = generatePKCEChallenge();

    // Generate state parameter (CSRF protection)
    const state = generateState();

    // Build redirect URI using NEXT_PUBLIC_APP_URL (reliable on Vercel)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/auth/oauth/google/callback`;

    // Store PKCE state for callback verification
    await storePKCEState(
      state,
      pkce.codeVerifier,
      'google',
      redirectUri,
      linkToUserId || undefined
    );

    // Build Google authorization URL with PKCE
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

    // Add return URL to state (encoded in the state parameter)
    // The actual returnTo is stored in PKCE state, but we can also include it in URL
    if (returnTo && returnTo !== '/dashboard') {
      authParams.append('state', `${state}|${encodeURIComponent(returnTo)}`);
    }

    const authorizationUrl = `${GOOGLE_CONFIG.authUrl}?${authParams.toString()}`;

    // Return authorization URL as JSON (client will handle redirect)
    // This avoids CORS issues when using fetch()
    return NextResponse.json({ authorizationUrl });
  } catch (error) {
    console.error('[Google OAuth] Initiation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initiate Google OAuth',
        message: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Node.js runtime required for crypto operations
export const runtime = 'nodejs';
