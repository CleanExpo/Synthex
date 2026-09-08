/**
 * Google OAuth callback for Synthex sign-in.
 *
 * This route is intentionally separate from `/api/auth/callback/[platform]`:
 * sign-in creates the Synthex session, while the generic callback connects a
 * third-party platform for an already-authenticated user.
 *
 * @route GET /api/auth/oauth/google/callback
 */

import { NextRequest, NextResponse } from 'next/server';
import { accountService } from '@/lib/auth/account-service';
import { getOAuthBaseUrl } from '@/lib/auth/oauth-base-url';
import { retrievePKCEState } from '@/lib/auth/pkce';
import { signInFlow } from '@/lib/auth/signInFlow';
import { hasInviteEvidence, isInviteOnlyMode } from '@/lib/auth/invite-gate';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import { encryptField } from '@/lib/security/field-encryption';

const GOOGLE_CONFIG = {
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
};

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email?: boolean;
  name?: string;
  picture?: string;
}

interface GoogleOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
  idToken?: string;
}

function getGoogleClientId(): string | undefined {
  return process.env.GOOGLE_CLIENT_ID?.trim() || undefined;
}

function getGoogleClientSecret(): string | undefined {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() || undefined;
}

export async function GET(request: NextRequest) {
  const effectiveBaseUrl = getOAuthBaseUrl(request);
  if (!effectiveBaseUrl) {
    return NextResponse.json(
      {
        error:
          'NEXT_PUBLIC_APP_URL must be configured for OAuth in production.',
      },
      { status: 500 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const providerError = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (providerError) {
      logger.error('[Google OAuth] Error from Google:', providerError);
      return redirectWithError(
        effectiveBaseUrl,
        errorDescription || providerError
      );
    }

    if (!code || !state) {
      return redirectWithError(
        effectiveBaseUrl,
        'Missing authorization code or state'
      );
    }

    const pkceState = await retrievePKCEState(state.split('|')[0]);
    if (!pkceState || pkceState.provider !== 'google') {
      return redirectWithError(
        effectiveBaseUrl,
        'Invalid or expired state. Please try again.'
      );
    }

    if (!getGoogleClientId() || !getGoogleClientSecret()) {
      return redirectWithError(effectiveBaseUrl, 'Google OAuth not configured');
    }

    const tokens = await exchangeCodeForTokens(
      code,
      pkceState.codeVerifier,
      pkceState.redirectUri
    );
    if (!tokens) {
      return redirectWithError(
        effectiveBaseUrl,
        'Failed to exchange authorization code'
      );
    }

    const googleUser = await getGoogleUserInfo(tokens.accessToken);
    if (!googleUser?.id || !googleUser.email) {
      return redirectWithError(
        effectiveBaseUrl,
        'Failed to get user information from Google'
      );
    }

    // Do not let the centralized OAuth flow turn an unverified provider
    // response into a verified Synthex identity. This check must happen before
    // any user/account persistence or session creation.
    if (googleUser.verified_email !== true) {
      return redirectWithError(
        effectiveBaseUrl,
        'Google account email is not verified'
      );
    }

    const profile = {
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      avatar: googleUser.picture,
      emailVerified: true,
    };

    if (pkceState.linkToUserId) {
      const linkResult = await accountService.linkAccount(
        pkceState.linkToUserId,
        'google',
        profile,
        tokens
      );
      if (!linkResult.success) {
        return redirectWithError(
          effectiveBaseUrl,
          linkResult.error || 'Failed to link Google account'
        );
      }

      return NextResponse.redirect(
        `${effectiveBaseUrl}/dashboard/settings/accounts?linked=google`
      );
    }

    // Persist the provider account before asking the centralized auth flow to
    // issue a session. This keeps a failed account write from producing a
    // usable login cookie.
    const existingByProvider = await accountService.findUserByProviderAccount(
      'google',
      profile.id
    );

    if (existingByProvider) {
      const result = await accountService.linkAccount(
        existingByProvider.userId,
        'google',
        profile,
        tokens
      );
      if (!result.success) {
        return redirectWithError(
          effectiveBaseUrl,
          result.error || 'Failed to persist Google account'
        );
      }
    } else {
      const existingByEmail = await accountService.findUserByEmail(
        profile.email
      );
      if (existingByEmail) {
        if (
          existingByEmail.hasPassword ||
          existingByEmail.providers.length > 0
        ) {
          const params = new URLSearchParams({
            error: 'account_exists',
            email: existingByEmail.email,
            existingProvider: existingByEmail.providers[0] || 'email',
            newProvider: 'google',
          });
          return NextResponse.redirect(
            `${effectiveBaseUrl}/login?${params.toString()}`
          );
        }

        const result = await accountService.linkAccount(
          existingByEmail.id,
          'google',
          profile,
          tokens
        );
        if (!result.success) {
          return redirectWithError(
            effectiveBaseUrl,
            result.error || 'Failed to persist Google account'
          );
        }
      } else {
        if (isInviteOnlyMode() && !(await hasInviteEvidence(profile.email))) {
          return redirectWithError(effectiveBaseUrl, 'invite_required');
        }

        const newUser = await prisma.user.create({
          data: {
            email: profile.email,
            password: null,
            name: profile.name || profile.email.split('@')[0],
            avatar: profile.avatar,
            googleId: profile.id,
            authProvider: 'google',
            emailVerified: profile.emailVerified,
            accounts: {
              create: {
                type: 'oauth',
                provider: 'google',
                providerAccountId: profile.id,
                accessToken: encryptField(tokens.accessToken),
                refreshToken: encryptField(tokens.refreshToken),
                expiresAt: tokens.expiresAt || null,
                tokenType: tokens.tokenType || null,
                scope: tokens.scope || null,
                idToken: encryptField(tokens.idToken),
              },
            },
          },
        });
      }
    }

    const authResult = await signInFlow.authenticate('oauth', {
      provider: 'google',
      oauthUser: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        image: profile.avatar,
      },
    });

    if (!authResult.success || !authResult.session) {
      if (authResult.existingProvider && authResult.existingEmail) {
        const params = new URLSearchParams({
          error: 'account_exists',
          email: authResult.existingEmail,
          existingProvider: authResult.existingProvider,
          newProvider: 'google',
        });
        return NextResponse.redirect(
          `${effectiveBaseUrl}/login?${params.toString()}`
        );
      }
      return redirectWithError(
        effectiveBaseUrl,
        authResult.error || 'authentication_failed'
      );
    }

    return redirectWithSession(effectiveBaseUrl, authResult.session);
  } catch (error) {
    logger.error('[Google OAuth] Callback error:', error);
    return redirectWithError(effectiveBaseUrl, 'authentication_failed');
  }
}

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<GoogleOAuthTokens | null> {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) return null;

  try {
    const response = await fetch(GOOGLE_CONFIG.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!response.ok) {
      logger.error('[Google OAuth] Token exchange failed:', response.status);
      return null;
    }

    const data = await response.json();
    if (!data.access_token) return null;
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
    logger.error('[Google OAuth] Token exchange error:', error);
    return null;
  }
}

async function getGoogleUserInfo(
  accessToken: string
): Promise<GoogleUserInfo | null> {
  try {
    const response = await fetch(GOOGLE_CONFIG.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      logger.error('[Google OAuth] User info request failed:', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    logger.error('[Google OAuth] User info error:', error);
    return null;
  }
}

function redirectWithSession(
  effectiveBaseUrl: string,
  session: {
    accessToken: string;
    user: { id: string; email: string; name?: string; avatar?: string };
  }
): NextResponse {
  const redirectUrl = new URL('/dashboard', effectiveBaseUrl);
  redirectUrl.searchParams.set('auth', 'success');
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set('auth-token', session.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });
  response.cookies.set('user-info', JSON.stringify(session.user), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });
  return response;
}

function redirectWithError(
  effectiveBaseUrl: string,
  error: string
): NextResponse {
  const redirectUrl = new URL('/login', effectiveBaseUrl);
  redirectUrl.searchParams.set('error', error);
  return NextResponse.redirect(redirectUrl);
}

export const runtime = 'nodejs';
