/**
 * GitHub Account Linking Route
 *
 * Initiates OAuth flow to link GitHub to an existing account.
 *
 * @route GET /api/auth/link/github
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - GITHUB_CLIENT_ID: GitHub OAuth client ID (CRITICAL)
 * - NEXT_PUBLIC_APP_URL: Application base URL
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns 401 if not authenticated, 500 if GitHub not configured
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { generateState, storePKCEState } from '@/lib/auth/pkce';

const GITHUB_CONFIG = {
  authUrl: 'https://github.com/login/oauth/authorize',
  clientId: process.env.GITHUB_CLIENT_ID,
  scope: 'read:user user:email',
};

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!GITHUB_CONFIG.clientId) {
      return NextResponse.json(
        { error: 'GitHub OAuth not configured' },
        { status: 500 }
      );
    }

    const state = generateState();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_APP_URL must be configured' },
        { status: 500 }
      );
    }
    const effectiveBaseUrl = baseUrl || 'http://localhost:3000';
    const redirectUri = `${effectiveBaseUrl}/api/auth/oauth/github/callback`;

    // Store state with linkToUserId flag so callback links instead of creates
    await storePKCEState(state, '', 'github', redirectUri, userId);

    const authParams = new URLSearchParams({
      client_id: GITHUB_CONFIG.clientId,
      redirect_uri: redirectUri,
      scope: GITHUB_CONFIG.scope,
      state,
    });

    const authorizationUrl = `${GITHUB_CONFIG.authUrl}?${authParams.toString()}`;

    return NextResponse.json({
      authorizationUrl,
      message: 'Redirecting to GitHub to link your account...',
    });
  } catch (error) {
    console.error('[Link GitHub] Error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate GitHub account linking' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
