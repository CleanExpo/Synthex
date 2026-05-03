/**
 * POST /api/integrations/ga4/connect
 *
 * Starts the Google Analytics 4 OAuth flow for the authenticated user.
 * Thin wrapper over the existing /api/auth/oauth/googleanalytics starter —
 * no OAuth logic is duplicated here. Returns the authorisation URL the
 * client should navigate to.
 *
 * SYN-793
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

const GA4_PLATFORM = 'googleanalytics';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delegate OAuth URL generation to the existing platform starter.
    // We re-use its signed-state + PKCE + credential resolution paths.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3008';
    const returnTo = '/dashboard/settings?tab=integrations&ga4=connected';
    const starterUrl = `${appUrl}/api/auth/oauth/${GA4_PLATFORM}?returnTo=${encodeURIComponent(returnTo)}`;

    const cookie = request.headers.get('cookie') ?? '';
    const upstream = await fetch(starterUrl, {
      method: 'GET',
      headers: { cookie },
    });

    if (!upstream.ok) {
      const errorBody = await upstream.text();
      logger.error('GA4 OAuth starter failed', {
        status: upstream.status,
        body: errorBody.substring(0, 200),
      });
      return NextResponse.json(
        {
          error: 'Failed to start Google Analytics OAuth',
          status: upstream.status,
        },
        { status: upstream.status >= 500 ? 502 : 400 }
      );
    }

    const data = (await upstream.json()) as {
      authorizationUrl?: string;
      platform?: string;
    };

    if (!data.authorizationUrl) {
      return NextResponse.json(
        { error: 'OAuth starter returned no authorization URL' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      authorizationUrl: data.authorizationUrl,
      platform: GA4_PLATFORM,
    });
  } catch (error) {
    logger.error('GA4 connect error:', error);
    return NextResponse.json(
      { error: 'Failed to start Google Analytics OAuth' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
