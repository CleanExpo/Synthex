/**
 * POST /api/integrations/ga4/connect
 *
 * Starts the Google Analytics 4 OAuth flow for the authenticated user.
 * Thin wrapper over the existing /api/auth/oauth/googleanalytics starter —
 * no OAuth logic is duplicated here. Returns the authorisation URL the
 * client should navigate to.
 *
 * Optional body (kit K2 onboarding authority): the "Synthex may create
 * Analytics for me" step. When the user accepts, the client sends
 *   { createAnalytics: { accepted: true, consentVersion, statement } }
 * with the exact GA4_ADMIN_CONSENT_STATEMENT it displayed. Only then is a
 * short-lived consent token passed to the starter, which adds the edit scope.
 * The token is bound to the organisation the statement was accepted for, and
 * that same organisation is passed to the starter, so the grant can only be
 * stored against it. Without the body the connect stays read-only, as before.
 *
 * SYN-793
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { getOAuthBaseUrl } from '@/lib/auth/oauth-base-url';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import {
  GA4_ADMIN_CONSENT_STATEMENT,
  GA4_ADMIN_CONSENT_VERSION,
  signGa4AdminConsent,
} from '@/lib/google/ga4-admin-consent';

const GA4_PLATFORM = 'googleanalytics';

const connectSchema = z.object({
  createAnalytics: z
    .object({
      accepted: z.literal(true),
      consentVersion: z.literal(GA4_ADMIN_CONSENT_VERSION),
      statement: z.literal(GA4_ADMIN_CONSENT_STATEMENT),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let rawBody: unknown = {};
    try {
      const text = await request.text();
      rawBody = text.trim() ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = connectSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Consent not accepted',
          message:
            'To let Synthex create Analytics, accept the current "Synthex may create Analytics for me" statement exactly as shown.',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }
    let consentToken: string | null = null;
    let consentOrganizationId: string | null = null;
    if (parsed.data.createAnalytics) {
      consentOrganizationId = await getEffectiveOrganizationId(userId);
      if (!consentOrganizationId) {
        return NextResponse.json(
          {
            error: 'Organization required',
            message:
              'Select or create the business that Synthex may create Analytics for, then accept the statement again.',
          },
          { status: 403 }
        );
      }
      consentToken = signGa4AdminConsent(userId, consentOrganizationId);
    }

    // Delegate OAuth URL generation to the existing platform starter.
    // We re-use its signed-state + PKCE + credential resolution paths.
    const appUrl = getOAuthBaseUrl(request);
    if (!appUrl) {
      return NextResponse.json(
        {
          error:
            'NEXT_PUBLIC_APP_URL must be configured for OAuth in production.',
        },
        { status: 500 }
      );
    }
    const returnTo = '/dashboard/settings?tab=integrations&ga4=connected';
    const starterUrl =
      `${appUrl}/api/auth/oauth/${GA4_PLATFORM}?returnTo=${encodeURIComponent(returnTo)}` +
      (consentToken && consentOrganizationId
        ? `&organizationId=${encodeURIComponent(consentOrganizationId)}` +
          `&ga4AdminConsent=${encodeURIComponent(consentToken)}`
        : '');

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
