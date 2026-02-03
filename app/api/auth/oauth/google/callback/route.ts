/**
 * Google OAuth Callback Route
 *
 * Handles the OAuth 2.0 callback from Google, exchanges the authorization
 * code for tokens, and creates/links user accounts.
 *
 * @route GET /api/auth/oauth/google/callback
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - GOOGLE_CLIENT_ID: Google OAuth client ID (CRITICAL)
 * - GOOGLE_CLIENT_SECRET: Google OAuth client secret (CRITICAL)
 * - NEXT_PUBLIC_APP_URL: Application base URL
 * - JWT_SECRET: Secret for JWT token generation (CRITICAL)
 *
 * FAILURE MODE: Redirects to /login with error message
 */

import { NextRequest, NextResponse } from 'next/server';
import { retrievePKCEState } from '@/lib/auth/pkce';
import { accountService } from '@/lib/auth/account-service';
import { signInFlow } from '@/lib/auth/signInFlow';
import prisma from '@/lib/prisma';

// Google OAuth configuration
const GOOGLE_CONFIG = {
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
};

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    // Parse callback parameters
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors from Google
    if (error) {
      console.error('[Google OAuth] Error from Google:', error, errorDescription);
      return redirectWithError(baseUrl, errorDescription || error);
    }

    // Validate required parameters
    if (!code || !state) {
      return redirectWithError(baseUrl, 'Missing authorization code or state');
    }

    // Retrieve and verify PKCE state
    const pkceState = await retrievePKCEState(state.split('|')[0]); // Handle state|returnTo format

    if (!pkceState) {
      return redirectWithError(baseUrl, 'Invalid or expired state. Please try again.');
    }

    // Validate Google OAuth is configured
    if (!GOOGLE_CONFIG.clientId || !GOOGLE_CONFIG.clientSecret) {
      return redirectWithError(baseUrl, 'Google OAuth not configured');
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(
      code,
      pkceState.codeVerifier,
      pkceState.redirectUri
    );

    if (!tokens) {
      return redirectWithError(baseUrl, 'Failed to exchange authorization code');
    }

    // Get user info from Google
    const googleUser = await getGoogleUserInfo(tokens.accessToken);

    if (!googleUser) {
      return redirectWithError(baseUrl, 'Failed to get user information from Google');
    }

    // Check if this is an account linking flow
    if (pkceState.linkToUserId) {
      // Link Google to existing user
      const linkResult = await accountService.linkAccount(
        pkceState.linkToUserId,
        'google',
        {
          id: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          avatar: googleUser.picture,
          emailVerified: googleUser.verified_email,
        },
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          tokenType: tokens.tokenType,
          scope: tokens.scope,
          idToken: tokens.idToken,
        }
      );

      if (!linkResult.success) {
        return redirectWithError(baseUrl, linkResult.error || 'Failed to link account');
      }

      // Redirect to account settings with success
      return NextResponse.redirect(
        `${baseUrl}/dashboard/settings/accounts?linked=google`
      );
    }

    // Regular login/signup flow
    // Check if user exists by Google ID or email
    const existingByGoogle = await accountService.findUserByProviderAccount(
      'google',
      googleUser.id
    );

    if (existingByGoogle) {
      // Existing Google user - login
      const session = await createSessionForUser(existingByGoogle.userId, googleUser, tokens);
      return redirectWithSession(baseUrl, session);
    }

    // Check if user exists by email
    const existingByEmail = await accountService.findUserByEmail(googleUser.email);

    if (existingByEmail) {
      // User exists with this email but different auth method
      // Offer to link accounts
      const providers = existingByEmail.providers.filter(p => p !== 'demo');

      if (providers.length > 0) {
        // Redirect to login with linking prompt
        const params = new URLSearchParams({
          error: 'account_exists',
          email: googleUser.email,
          existingProvider: providers[0],
          newProvider: 'google',
        });
        return NextResponse.redirect(`${baseUrl}/login?${params.toString()}`);
      }
    }

    // New user - create account
    const newUser = await createNewGoogleUser(googleUser, tokens);
    const session = await createSessionForUser(newUser.id, googleUser, tokens);

    return redirectWithSession(baseUrl, session);
  } catch (error) {
    console.error('[Google OAuth] Callback error:', error);
    return redirectWithError(
      baseUrl,
      error instanceof Error ? error.message : 'Authentication failed'
    );
  }
}

// ==========================================
// Helper Functions
// ==========================================

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
  idToken?: string;
} | null> {
  try {
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: GOOGLE_CONFIG.clientId!,
      client_secret: GOOGLE_CONFIG.clientSecret!,
      code_verifier: codeVerifier,
    });

    const response = await fetch(GOOGLE_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Google OAuth] Token exchange failed:', errorText);
      return null;
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? Math.floor(Date.now() / 1000) + data.expires_in
        : undefined,
      tokenType: data.token_type,
      scope: data.scope,
      idToken: data.id_token,
    };
  } catch (error) {
    console.error('[Google OAuth] Token exchange error:', error);
    return null;
  }
}

async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo | null> {
  try {
    const response = await fetch(GOOGLE_CONFIG.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('[Google OAuth] User info request failed:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[Google OAuth] User info error:', error);
    return null;
  }
}

async function createNewGoogleUser(
  googleUser: GoogleUserInfo,
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    tokenType?: string;
    scope?: string;
    idToken?: string;
  }
): Promise<{ id: string }> {
  // Create user (password is null for OAuth-only users)
  const user = await prisma.user.create({
    data: {
      email: googleUser.email,
      password: null, // OAuth-only user - no password
      name: googleUser.name || googleUser.email.split('@')[0],
      avatar: googleUser.picture,
      googleId: googleUser.id, // Legacy field
      authProvider: 'google', // Legacy field
      emailVerified: googleUser.verified_email,
    },
  });

  // Create Account record
  await accountService.createAccount(
    user.id,
    'google',
    {
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      avatar: googleUser.picture,
      emailVerified: googleUser.verified_email,
    },
    tokens
  );

  return { id: user.id };
}

async function createSessionForUser(
  userId: string,
  googleUser: GoogleUserInfo,
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
  }
): Promise<{
  accessToken: string;
  expiresAt: number;
  user: {
    id: string;
    email: string;
    name?: string;
    avatar?: string;
  };
}> {
  // Update tokens in account
  await accountService.updateTokens(userId, 'google', {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
  });

  // Update last login
  await prisma.user.update({
    where: { id: userId },
    data: { lastLogin: new Date() },
  });

  // Create session through SignInFlow
  const result = await signInFlow.authenticate('oauth', {
    provider: 'google',
    oauthUser: {
      id: userId,
      email: googleUser.email,
      name: googleUser.name,
      image: googleUser.picture,
    },
  });

  if (!result.success || !result.session) {
    throw new Error('Failed to create session');
  }

  return {
    accessToken: result.session.accessToken,
    expiresAt: result.session.expiresAt,
    user: {
      id: userId,
      email: googleUser.email,
      name: googleUser.name,
      avatar: googleUser.picture,
    },
  };
}

function redirectWithSession(
  baseUrl: string,
  session: {
    accessToken: string;
    expiresAt: number;
    user: { id: string; email: string; name?: string; avatar?: string };
  }
): NextResponse {
  // Create redirect response
  const redirectUrl = new URL('/dashboard', baseUrl);

  // Add success indicator
  redirectUrl.searchParams.set('auth', 'success');

  const response = NextResponse.redirect(redirectUrl);

  // Set auth cookie
  response.cookies.set('auth-token', session.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });

  // Set user info cookie (non-sensitive, for client-side)
  response.cookies.set(
    'user-info',
    JSON.stringify({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      avatar: session.user.avatar,
    }),
    {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    }
  );

  return response;
}

function redirectWithError(baseUrl: string, error: string): NextResponse {
  const redirectUrl = new URL('/login', baseUrl);
  redirectUrl.searchParams.set('error', error);
  return NextResponse.redirect(redirectUrl);
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
