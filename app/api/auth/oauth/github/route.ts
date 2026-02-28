/**
 * GitHub OAuth Initiation Route
 *
 * Initiates the OAuth 2.0 authorization code flow with state parameter
 * for secure authentication with GitHub.
 *
 * @route GET /api/auth/oauth/github
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - GITHUB_CLIENT_ID: GitHub OAuth client ID (CRITICAL)
 * - NEXT_PUBLIC_APP_URL: Application base URL for redirects
 *
 * FAILURE MODE: Returns 500 if GitHub OAuth not configured
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateState,
  storePKCEState,
  generatePKCEChallenge,
} from '@/lib/auth/pkce';

// GitHub OAuth configuration
const GITHUB_CONFIG = {
  authUrl: 'https://github.com/login/oauth/authorize',
  clientId: process.env.GITHUB_CLIENT_ID,
  scope: 'read:user user:email',
};

export async function GET(request: NextRequest) {
  try {
    // Validate GitHub OAuth is configured
    if (!GITHUB_CONFIG.clientId) {
      return NextResponse.json(
        {
          error: 'GitHub OAuth not configured',
          message: 'Please add GITHUB_CLIENT_ID to environment variables',
        },
        { status: 500 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const linkToUserId = searchParams.get('linkToUserId'); // For account linking
    const returnTo = searchParams.get('returnTo') || '/dashboard';

    // Generate PKCE challenge (used for state storage even though GitHub doesn't require PKCE)
    const pkce = generatePKCEChallenge();

    // Generate state parameter (CSRF protection)
    const state = generateState();

    // Build redirect URI from NEXT_PUBLIC_APP_URL (never from request headers
    // which can be spoofed, allowing an attacker to redirect the code to their server)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Configuration error', message: 'NEXT_PUBLIC_APP_URL must be configured for OAuth in production.' },
        { status: 500 }
      );
    }
    const redirectUri = `${appUrl || 'http://localhost:3000'}/api/auth/oauth/github/callback`;

    // Store PKCE state for callback verification
    await storePKCEState(
      state,
      pkce.codeVerifier,
      'github',
      redirectUri,
      linkToUserId || undefined
    );

    // Build GitHub authorization URL
    const authParams = new URLSearchParams({
      client_id: GITHUB_CONFIG.clientId,
      redirect_uri: redirectUri,
      scope: GITHUB_CONFIG.scope,
      state,
      allow_signup: 'true',
    });

    const authorizationUrl = `${GITHUB_CONFIG.authUrl}?${authParams.toString()}`;

    // Redirect to GitHub for authorization
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    console.error('[GitHub OAuth] Initiation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initiate GitHub OAuth',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Node.js runtime required for crypto operations
export const runtime = 'nodejs';
