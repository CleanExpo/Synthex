/**
 * GitHub OAuth Callback Route
 *
 * Handles the OAuth 2.0 callback from GitHub, exchanges the authorization
 * code for tokens, and creates/links user accounts.
 *
 * @route GET /api/auth/oauth/github/callback
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - GITHUB_CLIENT_ID: GitHub OAuth client ID (CRITICAL)
 * - GITHUB_CLIENT_SECRET: GitHub OAuth client secret (CRITICAL)
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

// GitHub OAuth configuration
const GITHUB_CONFIG = {
  tokenUrl: 'https://github.com/login/oauth/access_token',
  userInfoUrl: 'https://api.github.com/user',
  emailsUrl: 'https://api.github.com/user/emails',
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
};

interface GitHubUserInfo {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

export async function GET(request: NextRequest) {
  // Require NEXT_PUBLIC_APP_URL in production
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_APP_URL must be configured' },
      { status: 500 }
    );
  }
  const effectiveBaseUrl = baseUrl || 'http://localhost:3000';

  try {
    // Parse callback parameters
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors from GitHub
    if (error) {
      console.error('[GitHub OAuth] Error from GitHub:', error, errorDescription);
      return redirectWithError(effectiveBaseUrl, errorDescription || error);
    }

    // Validate required parameters
    if (!code || !state) {
      return redirectWithError(effectiveBaseUrl, 'Missing authorization code or state');
    }

    // Retrieve and verify PKCE state
    const pkceState = await retrievePKCEState(state.split('|')[0]); // Handle state|returnTo format

    if (!pkceState) {
      return redirectWithError(effectiveBaseUrl, 'Invalid or expired state. Please try again.');
    }

    // Validate GitHub OAuth is configured
    if (!GITHUB_CONFIG.clientId || !GITHUB_CONFIG.clientSecret) {
      return redirectWithError(effectiveBaseUrl, 'GitHub OAuth not configured');
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code, pkceState.redirectUri);

    if (!tokens) {
      return redirectWithError(effectiveBaseUrl, 'Failed to exchange authorization code');
    }

    // Get user info from GitHub
    const githubUser = await getGitHubUserInfo(tokens.accessToken);

    if (!githubUser) {
      return redirectWithError(effectiveBaseUrl, 'Failed to get user information from GitHub');
    }

    // Get email if not provided in user info
    let userEmail = githubUser.email;
    let emailVerified = false;

    if (!userEmail) {
      const emails = await getGitHubEmails(tokens.accessToken);
      const primaryEmail = emails?.find((e) => e.primary && e.verified);
      if (primaryEmail) {
        userEmail = primaryEmail.email;
        emailVerified = primaryEmail.verified;
      } else {
        return redirectWithError(effectiveBaseUrl, 'No verified email found on GitHub account');
      }
    } else {
      // Email from user info - check if verified via emails endpoint
      const emails = await getGitHubEmails(tokens.accessToken);
      const matchingEmail = emails?.find((e) => e.email === userEmail);
      emailVerified = matchingEmail?.verified || false;
    }

    // Create normalized user info
    const normalizedUser = {
      id: githubUser.id.toString(),
      email: userEmail,
      name: githubUser.name || githubUser.login,
      avatar: githubUser.avatar_url,
      emailVerified,
    };

    // Check if this is an account linking flow
    if (pkceState.linkToUserId) {
      // Link GitHub to existing user
      const linkResult = await accountService.linkAccount(
        pkceState.linkToUserId,
        'github',
        {
          id: normalizedUser.id,
          email: normalizedUser.email,
          name: normalizedUser.name || undefined,
          avatar: normalizedUser.avatar || undefined,
          emailVerified: normalizedUser.emailVerified,
        },
        {
          accessToken: tokens.accessToken,
          refreshToken: undefined, // GitHub doesn't provide refresh tokens
          expiresAt: undefined,
          tokenType: tokens.tokenType,
          scope: tokens.scope,
        }
      );

      if (!linkResult.success) {
        return redirectWithError(effectiveBaseUrl, linkResult.error || 'Failed to link account');
      }

      // Redirect to account settings with success
      return NextResponse.redirect(
        `${effectiveBaseUrl}/dashboard/settings/accounts?linked=github`
      );
    }

    // Regular login/signup flow
    // Check if user exists by GitHub ID
    const existingByGitHub = await accountService.findUserByProviderAccount(
      'github',
      normalizedUser.id
    );

    if (existingByGitHub) {
      // Existing GitHub user - login
      const session = await createSessionForUser(existingByGitHub.userId, normalizedUser, tokens);
      return redirectWithSession(effectiveBaseUrl, session);
    }

    // Check if user exists by email
    const existingByEmail = await accountService.findUserByEmail(normalizedUser.email);

    if (existingByEmail) {
      // User exists with this email but different auth method
      // Offer to link accounts
      const providers = existingByEmail.providers.filter((p) => p !== 'demo');

      if (providers.length > 0) {
        // Redirect to login with linking prompt
        const params = new URLSearchParams({
          error: 'account_exists',
          email: normalizedUser.email,
          existingProvider: providers[0],
          newProvider: 'github',
        });
        return NextResponse.redirect(`${effectiveBaseUrl}/login?${params.toString()}`);
      }
    }

    // New user - create account
    const newUser = await createNewGitHubUser(normalizedUser, tokens);
    const session = await createSessionForUser(newUser.id, normalizedUser, tokens);

    return redirectWithSession(effectiveBaseUrl, session);
  } catch (error) {
    console.error('[GitHub OAuth] Callback error:', error);
    return redirectWithError(
      effectiveBaseUrl,
      error instanceof Error ? error.message : 'Authentication failed'
    );
  }
}

// ==========================================
// Helper Functions
// ==========================================

async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  tokenType?: string;
  scope?: string;
} | null> {
  try {
    const tokenParams = new URLSearchParams({
      client_id: GITHUB_CONFIG.clientId!,
      client_secret: GITHUB_CONFIG.clientSecret!,
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(GITHUB_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: tokenParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GitHub OAuth] Token exchange failed:', errorText);
      return null;
    }

    const data = await response.json();

    if (data.error) {
      console.error('[GitHub OAuth] Token exchange error:', data.error, data.error_description);
      return null;
    }

    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      scope: data.scope,
    };
  } catch (error) {
    console.error('[GitHub OAuth] Token exchange error:', error);
    return null;
  }
}

async function getGitHubUserInfo(accessToken: string): Promise<GitHubUserInfo | null> {
  try {
    const response = await fetch(GITHUB_CONFIG.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      console.error('[GitHub OAuth] User info request failed:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[GitHub OAuth] User info error:', error);
    return null;
  }
}

async function getGitHubEmails(accessToken: string): Promise<GitHubEmail[] | null> {
  try {
    const response = await fetch(GITHUB_CONFIG.emailsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      console.error('[GitHub OAuth] Emails request failed:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[GitHub OAuth] Emails error:', error);
    return null;
  }
}

async function createNewGitHubUser(
  githubUser: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
    emailVerified: boolean;
  },
  tokens: {
    accessToken: string;
    tokenType?: string;
    scope?: string;
  }
): Promise<{ id: string }> {
  // Create user (password is null for OAuth-only users)
  const user = await prisma.user.create({
    data: {
      email: githubUser.email,
      password: null, // OAuth-only user - no password
      name: githubUser.name || githubUser.email.split('@')[0],
      avatar: githubUser.avatar,
      authProvider: 'github',
      emailVerified: githubUser.emailVerified,
    },
  });

  // Create Account record
  await accountService.createAccount(
    user.id,
    'github',
    {
      id: githubUser.id,
      email: githubUser.email,
      name: githubUser.name || undefined,
      avatar: githubUser.avatar || undefined,
      emailVerified: githubUser.emailVerified,
    },
    {
      accessToken: tokens.accessToken,
      tokenType: tokens.tokenType,
      scope: tokens.scope,
    }
  );

  return { id: user.id };
}

async function createSessionForUser(
  userId: string,
  githubUser: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
  },
  tokens: {
    accessToken: string;
    tokenType?: string;
    scope?: string;
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
  await accountService.updateTokens(userId, 'github', {
    accessToken: tokens.accessToken,
  });

  // Update last login
  await prisma.user.update({
    where: { id: userId },
    data: { lastLogin: new Date() },
  });

  // Create session through SignInFlow
  const result = await signInFlow.authenticate('oauth', {
    provider: 'github',
    oauthUser: {
      id: userId,
      email: githubUser.email,
      name: githubUser.name,
      image: githubUser.avatar,
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
      email: githubUser.email,
      name: githubUser.name || undefined,
      avatar: githubUser.avatar || undefined,
    },
  };
}

function redirectWithSession(
  effectiveBaseUrl: string,
  session: {
    accessToken: string;
    expiresAt: number;
    user: { id: string; email: string; name?: string; avatar?: string };
  }
): NextResponse {
  // Create redirect response
  const redirectUrl = new URL('/dashboard', effectiveBaseUrl);

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

function redirectWithError(effectiveBaseUrl: string, error: string): NextResponse {
  const redirectUrl = new URL('/login', effectiveBaseUrl);
  redirectUrl.searchParams.set('error', error);
  return NextResponse.redirect(redirectUrl);
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
