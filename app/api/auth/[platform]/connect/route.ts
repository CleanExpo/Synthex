/**
 * OAuth Connect Route
 *
 * @description Initiates OAuth flow for any supported platform
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - Platform-specific credentials (see individual providers)
 * - NEXT_PUBLIC_APP_URL: Application URL
 *
 * FAILURE MODE: Redirects to error page on invalid platform
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { startOAuthFlow, isSupportedPlatform } from '@/lib/oauth';
import { logger } from '@/lib/logger';

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;

    // Validate platform
    if (!isSupportedPlatform(platform)) {
      logger.warn('Invalid OAuth platform requested', { platform });
      return NextResponse.redirect(
        new URL(`/settings/connections?error=invalid_platform`, request.url)
      );
    }

    // Get user ID from session (simplified - implement proper auth check)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    const userId = sessionCookie?.value || 'anonymous';

    // Get optional redirect URL from query params
    const searchParams = request.nextUrl.searchParams;
    const redirectTo = searchParams.get('redirect') || '/settings/connections';

    // Start OAuth flow
    const { url, state } = startOAuthFlow(platform, userId, redirectTo);

    // Store state in cookie for verification
    const response = NextResponse.redirect(url);
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    logger.info('OAuth flow initiated', { platform, userId });

    return response;
  } catch (error) {
    logger.error('OAuth connect error', { error });

    return NextResponse.redirect(
      new URL('/settings/connections?error=oauth_error', request.url)
    );
  }
}
