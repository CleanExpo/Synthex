/**
 * OAuth Callback Handler — PLATFORM CONNECTION FLOW
 *
 * ============================================================================
 * IMPORTANT: This route is one of TWO Google OAuth callback patterns in
 * Synthex. They look similar and have caused production debugging confusion
 * (see UNI-1974). Read this header before editing.
 *
 * THIS ROUTE — `/api/auth/callback/[platform]`:
 *   Purpose:    Connect a third-party platform (LinkedIn, Twitter, GA4, etc.)
 *               to an ALREADY-LOGGED-IN Synthex user. Stores encrypted access
 *               tokens in `platform_connections` so the app can post on their
 *               behalf later.
 *   State flow: Settings → "Connect [Platform]" button → popup → THIS ROUTE →
 *               postMessage back to opener → opener refreshes integrations.
 *   Trigger:    `app/api/auth/oauth/[platform]/route.ts` constructs the URI as
 *               `${appUrl}/api/auth/callback/${platform}` and PKCE-signs state
 *               with `flow: 'integration'`.
 *
 * THE OTHER ROUTE — `/api/auth/oauth/google/callback/route.ts`:
 *   Purpose:    Sign IN to Synthex itself using Google as the identity
 *               provider (not a platform connection). Creates/links the
 *               public.users row, sets the `auth-token` cookie, redirects to
 *               /dashboard.
 *   Trigger:    `app/api/auth/oauth/google/route.ts` (different starter) and
 *               only ever for `platform=google`.
 *
 * ============================================================================
 * Why two routes exist:
 *   - The sign-in flow needs different post-success behaviour (set auth
 *     cookie + redirect to /dashboard), different state shape (no
 *     `flow: 'integration'`, no userId — there isn't one yet), and different
 *     storage target (public.users.google_id, not platform_connections).
 *   - The platform-connection flow needs popup + postMessage semantics so
 *     the originating settings page can refresh in-place.
 *
 * Canonical pattern going forward (per UNI-1974):
 *   - `/api/auth/oauth/<provider>/callback`  for sign-in flows
 *   - `/api/auth/callback/<provider>`        for platform-connection flows
 *
 * Do NOT add new sign-in providers under THIS route — use the
 * `/api/auth/oauth/<provider>/callback` pattern instead.
 * ============================================================================
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_APP_URL (PUBLIC)
 * - JWT_SECRET (CRITICAL)
 * - FIELD_ENCRYPTION_KEY: 32-byte hex key for token encryption (CRITICAL)
 * - OAUTH_STATE_SECRET: HMAC key for state validation (CRITICAL, falls back to JWT_SECRET)
 *
 * Platform OAuth credentials (client ID/secret) are loaded dynamically
 * from the database first, with env var fallback via getPlatformOAuthCredentials().
 *
 * @module app/api/auth/callback/[platform]/route
 *
 * NOTE: OAuth tokens are encrypted at rest using AES-256-GCM
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { generateToken, isOwnerEmail } from '@/lib/auth/jwt-utils';
import { encryptField } from '@/lib/security/field-encryption';
import { getPlatformOAuthCredentials } from '@/lib/platform-credentials';
import { persistPlatformConnection } from '@/lib/platform-connections/persistence';
import { resolveLinkedInOrganizationProfile } from '@/lib/social/linkedin-organization';
import {
  isAdhocPostNowPlatform,
  OWNED_PAGE_ACCOUNT_TYPE,
} from '@/lib/social/owned-page-policy';
import { retrievePKCEState } from '@/lib/auth/pkce';
import { getOAuthBaseUrl } from '@/lib/auth/oauth-base-url';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/observability/sentry-server';
import { isInviteOnlyMode, hasInviteEvidence } from '@/lib/auth/invite-gate';
import { META_GRAPH_BASE } from '@/lib/social/meta-graph-version';

// =============================================================================
// OAuth Configuration
// =============================================================================

interface OAuthConfig {
  tokenUrl: string;
  userInfoUrl: string;
  headers?: Record<string, string>;
  /** If true, token exchange uses Basic auth instead of body params (e.g. Reddit) */
  useBasicAuth?: boolean;
  /** If true, token exchange sends JSON body instead of form-urlencoded (e.g. TikTok) */
  useJsonBody?: boolean;
  /** TikTok uses client_key instead of client_id */
  clientIdParam?: string;
}

// OAuth configuration for different platforms (credentials loaded dynamically from DB)
const oauthConfigs: Record<string, OAuthConfig> = {
  google: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  },
  github: {
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    headers: { Accept: 'application/json' },
  },
  twitter: {
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userInfoUrl:
      'https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username',
    // Twitter OAuth 2.0 uses Basic auth for confidential clients
    useBasicAuth: true,
  },
  linkedin: {
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
  },
  facebook: {
    tokenUrl: `${META_GRAPH_BASE}/oauth/access_token`,
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,email,picture',
  },
  instagram: {
    tokenUrl: `${META_GRAPH_BASE}/oauth/access_token`,
    userInfoUrl: 'https://graph.instagram.com/me?fields=id,username',
  },
  tiktok: {
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    userInfoUrl:
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
    useJsonBody: true,
    clientIdParam: 'client_key',
  },
  youtube: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl:
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
  },
  pinterest: {
    tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    userInfoUrl: 'https://api.pinterest.com/v5/user_account',
    // Pinterest uses Basic auth for token exchange
    useBasicAuth: true,
  },
  reddit: {
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    userInfoUrl: 'https://oauth.reddit.com/api/v1/me',
    // Reddit REQUIRES Basic auth for token exchange
    useBasicAuth: true,
  },
  threads: {
    tokenUrl: 'https://graph.threads.net/oauth/access_token',
    userInfoUrl:
      'https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url',
  },
  searchconsole: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    // Standard userinfo — Search Console site data is fetched on demand using stored tokens
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  },
  googledrive: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  },
  googleanalytics: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    // Standard userinfo — GA4 property data is fetched on demand using stored tokens
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  },
  googlebusiness: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    // Standard userinfo — GBP location data is fetched on demand using stored tokens
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  },
};

// =============================================================================
// HTML Safety
// =============================================================================

/** Escape a string for safe embedding inside HTML / inline <script> */
function escapeForHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape a string for safe embedding inside a JS string literal */
function escapeForJs(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/<\//g, '<\\/'); // prevent </script> injection
}

/**
 * Build a safe HTML response that posts a message to the opener window and closes.
 * All user-controlled values are escaped to prevent XSS.
 */
function buildPostMessageHtml(
  type: 'oauth-success' | 'oauth-error',
  platform: string,
  extra: Record<string, string | null> = {},
  fallbackText?: string
): string {
  const safePlatform = escapeForJs(platform);
  const safeText = escapeForHtml(
    fallbackText ||
      (type === 'oauth-success' ? `Connected to ${platform}!` : `OAuth error`)
  );

  // Build the postMessage payload as safe JS
  const payloadParts = [`type: '${type}'`, `platform: '${safePlatform}'`];
  for (const [key, val] of Object.entries(extra)) {
    if (val === null) {
      payloadParts.push(`${escapeForJs(key)}: null`);
    } else {
      payloadParts.push(`${escapeForJs(key)}: '${escapeForJs(val)}'`);
    }
  }

  const safeType = escapeForJs(type);
  const successRedirect = `/dashboard/integrations?oauth_success=1&platform=${safePlatform}`;
  const errorRedirect = `/dashboard/integrations?oauth_error=1&platform=${safePlatform}`;
  const redirectUrl =
    type === 'oauth-success' ? successRedirect : errorRedirect;

  return `<!DOCTYPE html><html><body><script>
if (window.opener) {
  window.opener.postMessage({ ${payloadParts.join(', ')} }, window.location.origin);
  window.close();
} else {
  // Direct navigation (no popup) — redirect back to integrations
  window.location.href = '${escapeForJs(redirectUrl)}';
}
</script><p>${safeText}</p></body></html>`;
}

// =============================================================================
// Integration Flow Error Helper
// =============================================================================

/**
 * Build an error response for integration OAuth flows.
 * When returnTo is set (full-page redirect flow), redirects there with ?error=.
 * Otherwise falls back to postMessage HTML for popup-based flows.
 */
function integrationErrorResponse(
  platform: string,
  errorMsg: string,
  returnTo?: string,
  appBaseUrl?: string
): NextResponse {
  if (returnTo) {
    const isRelative =
      returnTo.startsWith('/') &&
      !returnTo.startsWith('//') &&
      !returnTo.includes('://');
    if (isRelative) {
      const appUrl =
        appBaseUrl ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'http://localhost:3008';
      try {
        const url = new URL(returnTo, appUrl);
        url.searchParams.set('error', errorMsg);
        return NextResponse.redirect(url.toString());
      } catch {
        // returnTo was invalid — fall through to postMessage
      }
    }
  }
  const html = buildPostMessageHtml(
    'oauth-error',
    platform,
    { error: errorMsg },
    `OAuth error: ${errorMsg}`
  );
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}

// =============================================================================
// State Verification
// =============================================================================

/**
 * Verify HMAC-signed state parameter.
 * Returns decoded state data or null if invalid.
 */
function verifyAndDecodeState(
  signedState: string
): Record<string, unknown> | null {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET;
  if (!secret) return null;

  const lastDot = signedState.lastIndexOf('.');
  if (lastDot === -1) {
    // No signature separator — reject; all state must be HMAC-signed.
    return null;
  }

  const payload = signedState.substring(0, lastDot);
  const signature = signedState.substring(lastDot + 1);

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) return null;
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    return null;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(
  platform: string,
  code: string,
  redirectUri: string,
  credentials: { clientId: string; clientSecret: string },
  codeVerifier?: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
}> {
  const config = oauthConfigs[platform];
  if (!config) {
    throw new Error(`OAuth not configured for ${platform}`);
  }

  const headers: Record<string, string> = {
    ...config.headers,
  };

  let body: string;

  if (config.useJsonBody) {
    // TikTok expects JSON body
    headers['Content-Type'] = 'application/json';
    const jsonBody: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    };
    // TikTok uses client_key
    jsonBody[config.clientIdParam || 'client_id'] = credentials.clientId;
    jsonBody.client_secret = credentials.clientSecret;
    if (codeVerifier) {
      jsonBody.code_verifier = codeVerifier;
    }
    body = JSON.stringify(jsonBody);
  } else {
    // Standard form-urlencoded
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const params: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    };

    // Reddit requires User-Agent on ALL requests including token exchange
    if (platform === 'reddit') {
      headers['User-Agent'] = 'web:Synthex:1.0 (by /u/synthex)';
    }

    // Basic auth: credentials go in Authorization header, not body
    if (config.useBasicAuth) {
      const basicAuth = Buffer.from(
        `${credentials.clientId}:${credentials.clientSecret}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
    } else {
      params.client_id = credentials.clientId;
      params.client_secret = credentials.clientSecret;
    }

    // Twitter PKCE requires code_verifier
    if (codeVerifier) {
      params.code_verifier = codeVerifier;
    }

    body = new URLSearchParams(params).toString();
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      `Token exchange failed for ${platform} (${response.status}):`,
      errorText
    );
    throw new Error(
      `Failed to exchange code for ${platform}: ${response.status} ${errorText.substring(0, 200)}`
    );
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
    scope: data.scope,
  };
}

/**
 * Fetch user info from OAuth provider
 */
async function fetchUserInfo(
  platform: string,
  accessToken: string,
  credentials?: { clientId: string; clientSecret: string }
): Promise<{
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  username?: string;
}> {
  const config = oauthConfigs[platform];
  if (!config) {
    throw new Error(`OAuth not configured for ${platform}`);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };

  // Reddit requires a User-Agent header
  if (platform === 'reddit') {
    headers['User-Agent'] = 'Synthex/1.0';
  }

  const response = await fetch(config.userInfoUrl, { headers });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      `User info fetch failed for ${platform} (${response.status}):`,
      errorText
    );
    throw new Error(
      `Failed to fetch user info from ${platform}: ${response.status}`
    );
  }

  const data = await response.json();

  // Normalize user info across providers
  switch (platform) {
    case 'google':
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        avatar: data.picture,
      };
    case 'github': {
      // GitHub may not return email directly, need to fetch separately
      let email = data.email;
      if (!email) {
        try {
          const emailResponse = await fetch(
            'https://api.github.com/user/emails',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          const emails = await emailResponse.json();
          email = emails.find(
            (e: { primary?: boolean; email: string }) => e.primary
          )?.email;
        } catch {
          // Email fetch failed, continue without it
        }
      }
      return {
        id: data.id.toString(),
        email,
        name: data.name || data.login,
        avatar: data.avatar_url,
        username: data.login,
      };
    }
    case 'twitter':
      return {
        id: data.data?.id || data.id,
        name: data.data?.name || data.name,
        avatar: data.data?.profile_image_url,
        username: data.data?.username || data.username,
      };
    case 'linkedin':
      return {
        id: data.sub,
        email: data.email,
        name: data.name,
        avatar: data.picture,
      };
    case 'facebook':
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        avatar: data.picture?.data?.url,
      };
    case 'instagram':
      return {
        id: data.id,
        username: data.username,
        name: data.username,
      };
    case 'tiktok':
      return {
        id: data.data?.user?.open_id || data.open_id || data.id || 'unknown',
        name: data.data?.user?.display_name || data.display_name,
        avatar: data.data?.user?.avatar_url || data.avatar_url,
      };
    case 'youtube': {
      const channel = data.items?.[0];
      return {
        id: channel?.id || data.id || 'unknown',
        name: channel?.snippet?.title,
        avatar: channel?.snippet?.thumbnails?.default?.url,
        username: channel?.snippet?.customUrl,
      };
    }
    case 'pinterest':
      return {
        id: data.username || data.id || 'unknown',
        name: data.username,
        avatar: data.profile_image,
        username: data.username,
      };
    case 'reddit':
      return {
        id: data.id || data.name || 'unknown',
        name: data.name,
        avatar: data.icon_img?.split('?')[0],
        username: data.name,
      };
    case 'threads':
      return {
        id: data.id || 'unknown',
        name: data.name || data.username,
        avatar: data.threads_profile_picture_url,
        username: data.username,
      };
    case 'searchconsole': {
      // Standard Google userinfo — Search Console site data is fetched on demand using stored tokens
      return {
        id: data.id || data.sub || 'search-console',
        name: data.name || data.email || 'Google Search Console',
        email: data.email,
        avatar: data.picture,
        username: data.email,
      };
    }
    case 'googleanalytics': {
      // Standard Google userinfo — GA4 property data is fetched on demand using stored tokens
      return {
        id: data.id || data.sub || 'google-analytics',
        name: data.name || data.email || 'Google Analytics',
        email: data.email,
        avatar: data.picture,
        username: data.email,
      };
    }
    case 'googledrive': {
      return {
        id: data.id || data.sub || 'google-drive',
        name: data.name || data.email || 'Google Drive',
        email: data.email,
        avatar: data.picture,
        username: data.email,
      };
    }
    case 'googlebusiness': {
      return {
        id: data.id || data.sub || 'google-business',
        name: data.name || data.email || 'Google Business Profile',
        email: data.email,
        avatar: data.picture,
        username: data.email,
      };
    }
    default:
      return {
        id: data.id || data.sub || 'unknown',
        email: data.email,
        name: data.name,
        avatar: data.picture || data.avatar_url,
      };
  }
}

// =============================================================================
// Route Handler
// =============================================================================

/**
 * Exchange a short-lived Meta (Facebook/Instagram) user token for a long-lived
 * one (~60 days) via the `fb_exchange_token` grant. Page access tokens derived
 * from a long-lived user token do not expire, so this removes the ~1-hour token
 * death at the root. Returns null on any failure so the caller keeps the
 * short-lived token (no regression).
 */
async function exchangeForLongLivedMetaToken(
  shortLivedToken: string,
  credentials: { clientId: string; clientSecret: string }
): Promise<{ accessToken: string; expiresIn?: number } | null> {
  try {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      fb_exchange_token: shortLivedToken,
    });
    const response = await fetch(
      `${META_GRAPH_BASE}/oauth/access_token?${params.toString()}`
    );
    if (!response.ok) {
      logger.warn(
        'Meta long-lived token exchange failed; keeping short-lived token',
        { status: response.status }
      );
      return null;
    }
    const data = await response.json();
    if (!data.access_token) return null;
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  } catch (error) {
    logger.warn(
      'Meta long-lived token exchange error; keeping short-lived token',
      { error: error instanceof Error ? error.message : String(error) }
    );
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform: rawPlatform } = await params;
    const platform = rawPlatform.toLowerCase();
    const callbackBaseUrl = getOAuthBaseUrl(request);

    // Validate platform string early — only allow alphanumeric characters
    // to prevent injection through the dynamic route segment
    if (!/^[a-z0-9]+$/.test(platform)) {
      return NextResponse.redirect(
        new URL('/login?error=Invalid platform', request.url)
      );
    }

    const { searchParams } = new URL(request.url);

    // Check for OAuth error from provider
    const error = searchParams.get('error');
    if (error) {
      const errorDescription =
        searchParams.get('error_description') || 'Authentication failed';
      logger.error(`OAuth error for ${platform}:`, error, {
        description: errorDescription,
      });

      // Check if this was an integration flow by looking at state
      const state = searchParams.get('state');
      if (state) {
        const stateData = verifyAndDecodeState(state);
        if (stateData?.flow === 'integration') {
          return integrationErrorResponse(
            platform,
            errorDescription,
            stateData.returnTo as string | undefined,
            callbackBaseUrl ?? undefined
          );
        }
      }

      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent(errorDescription)}`,
          request.url
        )
      );
    }

    // Get authorization code
    const code = searchParams.get('code');
    if (!code) {
      return NextResponse.redirect(
        new URL('/login?error=No authorization code received', request.url)
      );
    }

    // Get and validate state
    const state = searchParams.get('state');
    if (!state) {
      return NextResponse.redirect(
        new URL('/login?error=Invalid state parameter', request.url)
      );
    }

    // Verify HMAC signature and decode state
    const stateData = verifyAndDecodeState(state);
    if (!stateData) {
      return NextResponse.redirect(
        new URL('/login?error=Invalid or tampered state parameter', request.url)
      );
    }

    // Extract returnTo early — used by integrationErrorResponse to redirect back to
    // the correct page (e.g. /onboarding/connect) rather than the popup fallback.
    const earlyReturnTo = stateData.returnTo as string | undefined;

    // Platform connect flows now store every state server-side and consume it
    // once on callback. This gives real users enough time to complete Google /
    // Meta consent screens while retaining one-time replay protection.
    const pkceState = await retrievePKCEState(state);
    if (stateData.flow === 'integration' && !pkceState) {
      const expiredMsg =
        'Authentication session expired. Please try connecting again.';
      return integrationErrorResponse(
        platform,
        expiredMsg,
        earlyReturnTo,
        callbackBaseUrl ?? undefined
      );
    }

    // Login-style callbacks that do not use the integration state store keep the
    // tighter HMAC timestamp replay window.
    const LOGIN_STATE_EXPIRY_MS = 2 * 60 * 1000;
    const stateTimestamp = stateData.timestamp as number;
    if (
      stateData.flow !== 'integration' &&
      stateTimestamp &&
      Date.now() - stateTimestamp > LOGIN_STATE_EXPIRY_MS
    ) {
      const expiredMsg =
        'Authentication session expired. Please try connecting again.';
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(expiredMsg)}`, request.url)
      );
    }

    // Check if platform is supported
    if (!oauthConfigs[platform]) {
      if (stateData.flow === 'integration') {
        return integrationErrorResponse(
          platform,
          `Unsupported platform: ${platform}`,
          earlyReturnTo,
          callbackBaseUrl ?? undefined
        );
      }
      return NextResponse.redirect(
        new URL(
          `/login?error=Unsupported OAuth provider: ${platform}`,
          request.url
        )
      );
    }

    // Load credentials dynamically (checks DB first, falls back to env vars)
    const creds = await getPlatformOAuthCredentials(platform);
    if (!creds) {
      if (stateData.flow === 'integration') {
        return integrationErrorResponse(
          platform,
          'Platform not configured. Please contact your administrator.',
          earlyReturnTo,
          callbackBaseUrl ?? undefined
        );
      }
      return NextResponse.redirect(
        new URL(
          '/login?error=This platform connection has not been set up yet. Please contact your administrator.',
          request.url
        )
      );
    }

    if (!callbackBaseUrl) {
      return NextResponse.redirect(
        new URL(
          '/login?error=NEXT_PUBLIC_APP_URL must be configured for OAuth in production.',
          request.url
        )
      );
    }
    const redirectUri = `${callbackBaseUrl}/api/auth/callback/${platform}`;

    // Retrieve code verifier for PKCE platforms (Twitter)
    const codeVerifier = pkceState?.codeVerifier || undefined;

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(
      platform,
      code,
      redirectUri,
      creds,
      codeVerifier
    );

    // Facebook/Instagram (Meta): upgrade the short-lived (~1h) token to a
    // long-lived (~60-day) one via the fb_exchange_token grant. Page tokens
    // derived from a long-lived user token never expire, so this prevents the
    // ~1-hour token death at the root (mirrors lib/social/instagram-service).
    // Graceful: on any failure we keep the short-lived token (no regression).
    if (platform === 'facebook' || platform === 'instagram') {
      const longLived = await exchangeForLongLivedMetaToken(
        tokenData.accessToken,
        creds
      );
      if (longLived) {
        tokenData.accessToken = longLived.accessToken;
        tokenData.expiresIn = longLived.expiresIn;
      }
    }

    // Fetch user info
    const userInfo = await fetchUserInfo(
      platform,
      tokenData.accessToken,
      creds
    );

    // =========================================================================
    // Integration Flow (popup from Settings > Integrations)
    // User is already logged in -- just store the platform connection and close popup
    // =========================================================================
    if (stateData.flow === 'integration' && stateData.userId) {
      const userId = stateData.userId as string;
      const rawOrgId = (stateData.organizationId as string) || null;

      // Extract returnTo before try/catch so it is available in both error and success paths.
      const returnTo = stateData.returnTo as string | undefined;

      try {
        const expiresAt = tokenData.expiresIn
          ? new Date(Date.now() + tokenData.expiresIn * 1000)
          : null;

        const encryptedAccessToken = encryptField(
          tokenData.accessToken
        ) as string;
        const encryptedRefreshToken = tokenData.refreshToken
          ? (encryptField(tokenData.refreshToken) ?? undefined)
          : undefined;

        // LinkedIn org-scoped connections must store the NUMERIC organisation
        // id as profileId to post AS the company page — the OpenID member id
        // (userInfo.id) would silently target the personal feed instead.
        const linkedInOrg =
          platform === 'linkedin'
            ? await resolveLinkedInOrganizationProfile({
                accessToken: tokenData.accessToken,
                grantedScope: tokenData.scope,
              })
            : null;

        await persistPlatformConnection({
          userId,
          organizationId: rawOrgId,
          platform,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken ?? null,
          expiresAt,
          scope: tokenData.scope,
          profileId: linkedInOrg?.organizationId ?? (userInfo.id || 'default'),
          profileName: userInfo.name || userInfo.username,
          // Mark v1 auto-publish connections (IG/FB/LinkedIn) connected by the
          // team as owned business pages so ad-hoc "post now" is enabled without
          // the manual allowlist script. Other platforms keep the default
          // accountType and the legacy allowlist requirement.
          ...(isAdhocPostNowPlatform(platform)
            ? { accountType: OWNED_PAGE_ACCOUNT_TYPE }
            : {}),
          metadata: {
            tokenType: tokenData.tokenType,
            userInfo,
            ...(linkedInOrg
              ? {
                  linkedinOrganization: {
                    resolvedOrganizationId: linkedInOrg.organizationId,
                    adminOrganizationIds: linkedInOrg.adminOrganizationIds,
                    memberId: userInfo.id ?? null,
                  },
                }
              : {}),
          },
        });
      } catch (dbError) {
        // Surface the error to the user — do NOT silently swallow and fake success.
        logger.error('Failed to store platform connection:', dbError);
        return integrationErrorResponse(
          platform,
          'Failed to store platform connection. Please try again.',
          returnTo,
          callbackBaseUrl
        );
      }

      // Determine where to redirect after successful connection.
      // If returnTo is set in state (e.g. from onboarding/connect or platforms page),
      // do a full-page redirect back there. Otherwise close popup.
      if (returnTo) {
        const isRelative =
          returnTo.startsWith('/') &&
          !returnTo.startsWith('//') &&
          !returnTo.includes('://');
        if (isRelative) {
          const redirectUrl = new URL(returnTo, callbackBaseUrl);
          redirectUrl.searchParams.set('connected', platform);
          return NextResponse.redirect(redirectUrl.toString());
        }
      }

      // Close popup and notify parent window (include org context)
      const html = buildPostMessageHtml(
        'oauth-success',
        platform,
        { organizationId: rawOrgId ?? null },
        `Connected to ${platform}! This window will close automatically.`
      );
      return new NextResponse(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // =========================================================================
    // Login Flow (full-page redirect from login/signup page)
    // Find or create user, generate JWT, set cookies, redirect to dashboard
    // =========================================================================

    // Find existing user by email (the universal lookup -- NOT by platform-specific ID field,
    // since User model only has googleId and not twitterId/linkedinId/etc.)
    let user = userInfo.email
      ? await prisma.user.findUnique({ where: { email: userInfo.email } })
      : null;

    if (user) {
      // Update existing user with OAuth info
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          avatar: userInfo.avatar || user.avatar,
          name: userInfo.name || user.name,
          emailVerified: true,
          authProvider:
            user.authProvider === 'local' ? platform : user.authProvider,
          updatedAt: new Date(),
          ...(platform === 'google' ? { googleId: userInfo.id } : {}),
        },
      });
    } else if (userInfo.email) {
      // Invite-only market gate (fail closed): OAuth first-login must not
      // create an account for an uninvited email.
      if (isInviteOnlyMode() && !(await hasInviteEvidence(userInfo.email))) {
        logger.warn('[OAuth callback] Blocked uninvited signup', { platform });
        const inviteMsg =
          'Signups are invite-only during early access. Please use an invite link.';
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(inviteMsg)}`, request.url)
        );
      }

      // Create new user
      user = await prisma.user.create({
        data: {
          email: userInfo.email,
          name: userInfo.name || `${platform} User`,
          password: '', // Empty password for OAuth users
          avatar: userInfo.avatar,
          authProvider: platform,
          emailVerified: true,
          ...(platform === 'google' ? { googleId: userInfo.id } : {}),
        },
      });
    } else {
      // Platform did not provide email (common for Twitter, TikTok, Reddit, Pinterest)
      // For login flow, we cannot create an account without email
      const noEmailMsg = `${platform} did not provide an email address. Please use a different login method or connect ${platform} from Settings after logging in.`;
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(noEmailMsg)}`, request.url)
      );
    }

    // Store platform connection for social features
    try {
      const expiresAt = tokenData.expiresIn
        ? new Date(Date.now() + tokenData.expiresIn * 1000)
        : null;

      // Encrypt tokens before storing (accessToken is required)
      const encryptedAccessToken = encryptField(
        tokenData.accessToken
      ) as string;
      const encryptedRefreshToken = tokenData.refreshToken
        ? (encryptField(tokenData.refreshToken) ?? undefined)
        : undefined;

      await persistPlatformConnection({
        userId: user.id,
        organizationId: user.organizationId ?? null,
        platform,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken ?? null,
        expiresAt,
        scope: tokenData.scope,
        profileId: userInfo.id || 'default',
        profileName: userInfo.name || userInfo.username,
        metadata: {
          tokenType: tokenData.tokenType,
          userInfo,
        },
      });
    } catch (dbError) {
      logger.error('Failed to store platform connection:', dbError);
      // Continue - user auth succeeded, just connection storage failed
    }

    // Owner bypass: force full access for platform owner(s)
    const ownerBypass = isOwnerEmail(user.email);
    const onboardingComplete = ownerBypass ? true : user.onboardingComplete;
    const apiKeyConfigured = ownerBypass ? true : user.apiKeyConfigured;

    // Auto-fix DB flags for owner on login (fire-and-forget)
    if (ownerBypass && (!user.onboardingComplete || !user.apiKeyConfigured)) {
      prisma.user
        .update({
          where: { id: user.id },
          data: { onboardingComplete: true, apiKeyConfigured: true },
        })
        .catch(() => {
          /* non-fatal */
        });
    }

    // Generate JWT token (include onboarding flags for middleware)
    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name ?? undefined,
      onboardingComplete,
      apiKeyConfigured,
    });

    // Redirect based on onboarding status: new/incomplete -> /onboarding, complete -> /dashboard
    const redirectPath = onboardingComplete ? '/dashboard' : '/onboarding';
    const response = NextResponse.redirect(new URL(redirectPath, request.url));

    // Set secure cookie with token
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    // Also set a non-httpOnly cookie for client-side access
    response.cookies.set(
      'user-session',
      JSON.stringify({
        userId: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      }),
      {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      }
    );

    return response;
  } catch (error: unknown) {
    logger.error('OAuth callback error:', error);

    // Alert on OAuth callback failures — a throw here means the user cannot
    // connect/sign-in and we previously only console-logged. Fire-and-forget,
    // DSN-gated no-op, secret-scrubbed: derive `platform` from the (non-secret)
    // route path only — the OAuth `code`, tokens and `state` are NEVER captured.
    let oauthPlatform = 'unknown';
    try {
      oauthPlatform =
        new URL(request.url).pathname
          .split('/')
          .filter(Boolean)
          .pop()
          ?.toLowerCase() ?? 'unknown';
    } catch {
      // URL parse failed — keep 'unknown'.
    }
    captureServerException(error, {
      level: 'error',
      operation: 'oauth/callback',
      tags: { oauth: 'callback', platform: oauthPlatform },
    });

    // Try to determine if this was an integration flow to show a contextual error
    try {
      const state = new URL(request.url).searchParams.get('state');
      if (state) {
        const stateData = verifyAndDecodeState(state);
        if (stateData?.flow === 'integration') {
          const returnTo = stateData.returnTo as string | undefined;
          // Use the platform from state if available, else fall back to URL segment
          const errPlatform =
            (stateData.platform as string | undefined) ?? 'unknown';
          return integrationErrorResponse(
            errPlatform,
            'Authentication failed. Please try again.',
            returnTo,
            getOAuthBaseUrl(request) ?? undefined
          );
        }
      }
    } catch {
      // State parsing failed, fall through to redirect
    }

    return NextResponse.redirect(
      new URL('/login?error=authentication_failed', request.url)
    );
  }
}

export const runtime = 'nodejs';
