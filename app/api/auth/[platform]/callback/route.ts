/**
 * OAuth Callback Route
 *
 * @description Handles OAuth callbacks from all platforms
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - Platform-specific credentials (see individual providers)
 * - NEXT_PUBLIC_APP_URL: Application URL
 *
 * FAILURE MODE: Redirects to error page with error details
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { handleOAuthCallback, isSupportedPlatform, OAuthError, OAuthStateManager } from '@/lib/oauth';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const cookieStore = await cookies();
  let redirectTo = '/settings/connections';

  try {
    const { platform } = await params;

    // Validate platform
    if (!isSupportedPlatform(platform)) {
      logger.warn('Invalid OAuth callback platform', { platform });
      return NextResponse.redirect(
        new URL(`/settings/connections?error=invalid_platform`, request.url)
      );
    }

    // Get callback params
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code') || undefined;
    const state = searchParams.get('state');
    const error = searchParams.get('error') || undefined;
    const errorDescription = searchParams.get('error_description') || undefined;

    // Validate state exists
    if (!state) {
      logger.warn('OAuth callback missing state', { platform });
      return NextResponse.redirect(
        new URL('/settings/connections?error=missing_state', request.url)
      );
    }

    // Verify state matches stored cookie (defense-in-depth)
    const storedState = cookieStore.get('oauth_state')?.value;
    if (!storedState || storedState !== state) {
      logger.warn('OAuth state cookie mismatch - potential CSRF attempt', {
        platform,
        hasStoredState: !!storedState,
        storedStateLength: storedState?.length,
        receivedStateLength: state?.length,
        clientIp: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent')?.substring(0, 100),
      });
      return NextResponse.redirect(
        new URL('/settings/connections?error=invalid_state&reason=cookie_mismatch', request.url)
      );
    }

    // Validate state cryptographically and check expiration
    // This includes HMAC verification and 10-minute timestamp check
    let parsedState;
    try {
      parsedState = OAuthStateManager.parseState(state);

      // Extract redirect URL from validated state
      if (parsedState.redirectTo) {
        redirectTo = parsedState.redirectTo;
      }
    } catch (stateError) {
      // State validation failed - this is a security event
      const errorMessage = stateError instanceof OAuthError
        ? stateError.message
        : 'Unknown state validation error';
      const errorCode = stateError instanceof OAuthError
        ? stateError.code
        : 'INVALID_STATE';

      logger.error('OAuth state validation FAILED - Security Alert', {
        platform,
        errorCode,
        errorMessage,
        clientIp: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent')?.substring(0, 100),
        referer: request.headers.get('referer'),
      });

      // Clear the potentially compromised cookie
      const errorResponse = NextResponse.redirect(
        new URL(`/settings/connections?error=${errorCode}&message=${encodeURIComponent(errorMessage)}`, request.url)
      );
      errorResponse.cookies.delete('oauth_state');

      return errorResponse;
    }

    // Handle the callback
    const result = await handleOAuthCallback({
      code,
      state,
      error,
      errorDescription,
    });

    // Store the connection in the database
    await storeConnection(result);

    logger.info('OAuth connection successful', {
      platform,
      userId: result.userInfo.id,
    });

    // Clear OAuth state cookie
    const response = NextResponse.redirect(
      new URL(`${redirectTo}?success=connected&platform=${platform}`, request.url)
    );
    response.cookies.delete('oauth_state');

    return response;
  } catch (error) {
    logger.error('OAuth callback error', { error });

    // Build error redirect URL
    let errorCode = 'unknown';
    let errorMessage = 'An error occurred during authentication';

    if (error instanceof OAuthError) {
      errorCode = error.code;
      errorMessage = error.message;
    }

    const errorUrl = new URL(redirectTo, request.url);
    errorUrl.searchParams.set('error', errorCode);
    errorUrl.searchParams.set('error_message', errorMessage);

    const response = NextResponse.redirect(errorUrl);
    response.cookies.delete('oauth_state');

    return response;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Store OAuth connection in database
 */
async function storeConnection(result: {
  platform: string;
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scope?: string;
  };
  userInfo: {
    id: string;
    username?: string;
    displayName?: string;
    email?: string;
    avatar?: string;
    profileUrl?: string;
  };
}): Promise<void> {
  const { platform, tokens, userInfo } = result;

  try {
    // Find existing connection
    const existing = await prisma.platformConnection.findFirst({
      where: {
        userId: userInfo.id,
        platform,
        profileId: userInfo.id,
      },
    });

    if (existing) {
      // Update existing connection
      await prisma.platformConnection.update({
        where: { id: existing.id },
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          scope: tokens.scope,
          profileName: userInfo.username || userInfo.displayName,
          isActive: true,
          lastSync: new Date(),
          metadata: {
            avatar: userInfo.avatar,
            profileUrl: userInfo.profileUrl,
          },
        },
      });
    } else {
      // Create new connection
      await prisma.platformConnection.create({
        data: {
          userId: userInfo.id, // This should come from session, simplified here
          platform,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          scope: tokens.scope,
          profileId: userInfo.id,
          profileName: userInfo.username || userInfo.displayName,
          isActive: true,
          lastSync: new Date(),
          metadata: {
            avatar: userInfo.avatar,
            profileUrl: userInfo.profileUrl,
          },
        },
      });
    }
  } catch (error) {
    // Log but don't throw - connection data is in response
    logger.error('Failed to store OAuth connection', { platform, error });
  }
}

export const runtime = 'nodejs';
