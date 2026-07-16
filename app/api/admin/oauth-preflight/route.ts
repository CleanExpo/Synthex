/**
 * Admin API: OAuth Connect Preflight
 *
 * GET /api/admin/oauth-preflight[?platform=twitter]
 *
 * Reports the NON-SECRET facts about the OAuth client credential the app will
 * actually send to each provider — resolved exactly as the connect flow resolves
 * it (DB row first, then environment variable). This closes the diagnostic blind
 * spot behind the recurring X "Something went wrong — you weren't able to give
 * access to the App" dead end: that error is almost always an OAuth 1.0a API Key
 * sitting in the OAuth 2.0 Client ID slot (wrong shape), or the X app's Callback
 * URI not matching the redirect_uri below. Both are invisible from outside the
 * running app; this endpoint surfaces them to the owner without exposing a secret.
 *
 * OWNER-ONLY. Never returns a client secret. The client id is public (it travels
 * in the authorize URL) so a short preview + its length + shape verdict are safe.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isOwnerEmail } from '@/lib/auth/jwt-utils';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import {
  getPlatformOAuthCredentials,
  classifyClientIdShape,
  isPlatformEnvClientIdSet,
} from '@/lib/platform-credentials';
import { getOAuthBaseUrl } from '@/lib/auth/oauth-base-url';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLATFORMS = [
  'twitter',
  'linkedin',
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'pinterest',
  'reddit',
  'threads',
] as const;

/** Owner gate — mirrors app/api/admin/platform-credentials/route.ts. */
async function requireOwner(
  request: NextRequest
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  const user = await prisma.user.findUnique({
    where: { id: security.context.userId! },
    select: { email: true },
  });
  if (!user?.email || !isOwnerEmail(user.email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden', message: 'Owner access required' },
        { status: 403 }
      ),
    };
  }
  return { ok: true };
}

/** First 6 + last 3 of a public client id — enough to compare against the portal. */
function previewClientId(clientId: string): string {
  if (clientId.length <= 9) return `${clientId.slice(0, 2)}…`;
  return `${clientId.slice(0, 6)}…${clientId.slice(-3)}`;
}

async function hasActiveDbCredential(platform: string): Promise<boolean> {
  try {
    if (
      prisma == null ||
      typeof prisma.platformOAuthCredential?.findUnique !== 'function'
    ) {
      return false;
    }
    const record = await prisma.platformOAuthCredential.findUnique({
      where: { platform },
      select: { isActive: true, encryptedClientId: true },
    });
    return Boolean(record?.isActive && record?.encryptedClientId);
  } catch {
    return false;
  }
}

async function preflightPlatform(platform: string, redirectUri: string) {
  const creds = await getPlatformOAuthCredentials(platform);

  if (!creds) {
    return {
      platform,
      configured: false,
      source: null as null,
      redirectUri,
      verdict: 'NOT_CONFIGURED',
      message: `No OAuth credentials resolve for ${platform}. Set the OAuth 2.0 client id/secret env vars (or add them under Settings > Platform Credentials).`,
    };
  }

  const source = (await hasActiveDbCredential(platform))
    ? 'db'
    : isPlatformEnvClientIdSet(platform)
      ? 'env'
      : 'unknown';
  const len = creds.clientId.length;
  const shape = classifyClientIdShape(len);

  let verdict = 'OK';
  let message =
    `Client id resolves (source: ${source}) and is ${shape}. If the provider still ` +
    `rejects at the authorize screen, the mismatch is in the provider app itself: its ` +
    `OAuth 2.0 "Callback URI / Redirect URL" must EXACTLY equal the redirectUri above.`;

  if (platform === 'twitter' && shape === 'oauth1-shaped') {
    verdict = 'WRONG_TYPE_OAUTH1';
    message =
      `The resolved X client id is ${len} chars — the shape of an OAuth 1.0a API Key, ` +
      `NOT an OAuth 2.0 Client ID (~34+ chars). Synthex uses OAuth 2.0, so X rejects this ` +
      `at authorize ("Something went wrong — you weren't able to give access to the App"). ` +
      `Fix: in the X app's Keys-and-tokens page, copy the "OAuth 2.0 Client ID and Client ` +
      `Secret" (User authentication settings) and set them as TWITTER_CLIENT_ID / ` +
      `TWITTER_CLIENT_SECRET, then redeploy.`;
  } else if (platform === 'twitter' && shape === 'oauth2-shaped') {
    verdict = 'OK';
    message =
      `The resolved X client id is ${len} chars (OAuth 2.0-shaped) — the credential TYPE ` +
      `is correct. If X still shows "Something went wrong" at authorize, the problem is in ` +
      `the X app's OAuth 2.0 settings: (1) "Callback URI / Redirect URL" must EXACTLY equal ` +
      `${redirectUri} ; (2) "Type of App" must be Web App / Confidential client (the token ` +
      `exchange uses Basic auth); (3) scopes tweet.read, tweet.write, users.read and ` +
      `offline.access must be enabled.`;
  }

  return {
    platform,
    configured: true,
    source,
    clientId: { len, shape, preview: previewClientId(creds.clientId) },
    redirectUri,
    verdict,
    message,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if (!auth.ok) return auth.response;

    const appUrl = getOAuthBaseUrl(request);
    if (!appUrl) {
      return NextResponse.json(
        {
          error: 'Configuration error',
          message: 'NEXT_PUBLIC_APP_URL is not configured.',
        },
        { status: 500 }
      );
    }

    const requested = request.nextUrl.searchParams
      .get('platform')
      ?.toLowerCase()
      .trim();
    if (requested && !(PLATFORMS as readonly string[]).includes(requested)) {
      return NextResponse.json(
        {
          error: 'Unknown platform',
          message: `Supported: ${PLATFORMS.join(', ')}`,
        },
        { status: 400 }
      );
    }
    const platforms = requested
      ? [requested]
      : (PLATFORMS as readonly string[]);

    const results = [];
    for (const platform of platforms) {
      const redirectUri = `${appUrl}/api/auth/callback/${platform}`;
      results.push(await preflightPlatform(platform, redirectUri));
    }

    return NextResponse.json({ appUrl, platforms: results });
  } catch (error) {
    logger.error('[OAuth Preflight] GET error:', error);
    return NextResponse.json(
      { error: sanitizeErrorForResponse(error, 'Preflight failed') },
      { status: 500 }
    );
  }
}
