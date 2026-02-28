/**
 * OAuth Callback Handler
 *
 * Handles OAuth callbacks from all supported platforms.
 * Processes authorization codes, exchanges for tokens, and creates/updates users.
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
import { retrievePKCEState } from '@/lib/auth/pkce';

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
    userInfoUrl: 'https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username',
    // Twitter OAuth 2.0 uses Basic auth for confidential clients
    useBasicAuth: true,
  },
  linkedin: {
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
  },
  facebook: {
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,email,picture',
  },
  instagram: {
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoUrl: 'https://graph.instagram.com/me?fields=id,username',
  },
  tiktok: {
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    userInfoUrl: 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
    useJsonBody: true,
    clientIdParam: 'client_key',
  },
  youtube: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
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
    userInfoUrl: 'https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url',
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
    .replace(/<\//g, '<\\/');  // prevent </script> injection
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
  const safeText = escapeForHtml(fallbackText || (type === 'oauth-success' ? `Connected to ${platform}!` : `OAuth error`));

  // Build the postMessage payload as safe JS
  const payloadParts = [`type: '${type}'`, `platform: '${safePlatform}'`];
  for (const [key, val] of Object.entries(extra)) {
    if (val === null) {
      payloadParts.push(`${escapeForJs(key)}: null`);
    } else {
      payloadParts.push(`${escapeForJs(key)}: '${escapeForJs(val)}'`);
    }
  }

  return `<!DOCTYPE html><html><body><script>
if (window.opener) {
  window.opener.postMessage({ ${payloadParts.join(', ')} }, window.location.origin);
}
window.close();
</script><p>${safeText}</p></body></html>`;
}

// =============================================================================
// State Verification
// =============================================================================

/**
 * Verify HMAC-signed state parameter.
 * Returns decoded state data or null if invalid.
 */
function verifyAndDecodeState(signedState: string): Record<string, unknown> | null {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET;
  if (!secret) return null;

  const lastDot = signedState.lastIndexOf('.');
  if (lastDot === -1) {
    // Legacy unsigned state -- try base64 decode for backward compatibility
    try {
      return JSON.parse(Buffer.from(signedState, 'base64').toString());
    } catch {
      return null;
    }
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

    // Basic auth: credentials go in Authorization header, not body
    if (config.useBasicAuth) {
      const basicAuth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');
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
    console.error(`Token exchange failed for ${platform} (${response.status}):`, errorText);
    throw new Error(`Failed to exchange code for ${platform}: ${response.status} ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
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
    console.error(`User info fetch failed for ${platform} (${response.status}):`, errorText);
    throw new Error(`Failed to fetch user info from ${platform}: ${response.status}`);
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
          const emailResponse = await fetch('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const emails = await emailResponse.json();
          email = emails.find((e: { primary?: boolean; email: string }) => e.primary)?.email;
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform: rawPlatform } = await params;
    const platform = rawPlatform.toLowerCase();

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
      const errorDescription = searchParams.get('error_description') || 'Authentication failed';
      console.error(`OAuth error for ${platform}:`, error, errorDescription);

      // Check if this was an integration flow by looking at state
      const state = searchParams.get('state');
      if (state) {
        const stateData = verifyAndDecodeState(state);
        if (stateData?.flow === 'integration') {
          const html = buildPostMessageHtml('oauth-error', platform, { error: errorDescription }, `OAuth error: ${errorDescription}`);
          return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
        }
      }

      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(errorDescription)}`, request.url)
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

    // Validate state timestamp (10 minute expiry -- generous for slow users)
    const stateTimestamp = stateData.timestamp as number;
    if (stateTimestamp && Date.now() - stateTimestamp > 10 * 60 * 1000) {
      const expiredMsg = 'Authentication session expired. Please try connecting again.';
      if (stateData.flow === 'integration') {
        const html = buildPostMessageHtml('oauth-error', platform, { error: expiredMsg }, expiredMsg);
        return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(expiredMsg)}`, request.url)
      );
    }

    // Check if platform is supported
    if (!oauthConfigs[platform]) {
      if (stateData.flow === 'integration') {
        const html = buildPostMessageHtml('oauth-error', platform, { error: 'Unsupported platform' }, `Unsupported platform: ${platform}`);
        return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
      return NextResponse.redirect(
        new URL(`/login?error=Unsupported OAuth provider: ${platform}`, request.url)
      );
    }

    // Load credentials dynamically (checks DB first, falls back to env vars)
    const creds = await getPlatformOAuthCredentials(platform);
    if (!creds) {
      if (stateData.flow === 'integration') {
        const html = buildPostMessageHtml('oauth-error', platform, { error: 'Platform not configured' }, 'This platform connection has not been set up yet. Please contact your administrator.');
        return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
      return NextResponse.redirect(
        new URL('/login?error=This platform connection has not been set up yet. Please contact your administrator.', request.url)
      );
    }

    // Build redirect URI - require NEXT_PUBLIC_APP_URL in production
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl && process.env.NODE_ENV === 'production') {
      return NextResponse.redirect(
        new URL('/login?error=NEXT_PUBLIC_APP_URL must be configured', request.url)
      );
    }
    const redirectUri = `${appUrl || 'http://localhost:3000'}/api/auth/callback/${platform}`;

    // Retrieve code verifier for PKCE platforms (Twitter)
    let codeVerifier: string | undefined;
    const pkceState = await retrievePKCEState(state);
    if (pkceState?.codeVerifier) {
      codeVerifier = pkceState.codeVerifier;
    }

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(platform, code, redirectUri, creds, codeVerifier);

    // Fetch user info
    const userInfo = await fetchUserInfo(platform, tokenData.accessToken, creds);

    // =========================================================================
    // Integration Flow (popup from Settings > Integrations)
    // User is already logged in -- just store the platform connection and close popup
    // =========================================================================
    if (stateData.flow === 'integration' && stateData.userId) {
      const userId = stateData.userId as string;
      // Use empty string for null orgId — Prisma composite unique constraints
      // cannot match NULL values, so we store '' as the "no org" sentinel.
      const rawOrgId = (stateData.organizationId as string) || null;
      const orgIdForDb = rawOrgId ?? '';

      try {
        const expiresAt = tokenData.expiresIn
          ? new Date(Date.now() + tokenData.expiresIn * 1000)
          : null;

        const encryptedAccessToken = encryptField(tokenData.accessToken) as string;
        const encryptedRefreshToken = tokenData.refreshToken
          ? encryptField(tokenData.refreshToken) ?? undefined
          : undefined;

        await prisma.platformConnection.upsert({
          where: {
            unique_user_platform_org: {
              userId,
              platform,
              organizationId: orgIdForDb,
            },
          },
          update: {
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken ?? null,
            expiresAt,
            profileId: userInfo.id || 'default',
            isActive: true,
            updatedAt: new Date(),
            profileName: userInfo.name || userInfo.username,
            metadata: {
              tokenType: tokenData.tokenType,
              userInfo,
            },
          },
          create: {
            userId,
            organizationId: orgIdForDb || null,
            platform,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken ?? null,
            expiresAt,
            scope: '',
            profileId: userInfo.id || 'default',
            profileName: userInfo.name || userInfo.username,
            isActive: true,
            metadata: {
              tokenType: tokenData.tokenType,
              userInfo,
            },
          },
        });
      } catch (dbError) {
        console.error('Failed to store platform connection:', dbError);
      }

      // Close popup and notify parent window (include org context)
      const html = buildPostMessageHtml('oauth-success', platform, { organizationId: rawOrgId ?? null }, `Connected to ${platform}! This window will close automatically.`);
      return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
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
          authProvider: user.authProvider === 'local' ? platform : user.authProvider,
          updatedAt: new Date(),
          ...(platform === 'google' ? { googleId: userInfo.id } : {}),
        },
      });
    } else if (userInfo.email) {
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
      const encryptedAccessToken = encryptField(tokenData.accessToken) as string;
      const encryptedRefreshToken = tokenData.refreshToken
        ? encryptField(tokenData.refreshToken) ?? undefined
        : undefined;

      // Login flow -- store connection with user's primary org (or null)
      // Use empty string for null orgId to match composite unique constraint
      const loginOrgId = user.organizationId ?? '';

      await prisma.platformConnection.upsert({
        where: {
          unique_user_platform_org: {
            userId: user.id,
            platform,
            organizationId: loginOrgId,
          },
        },
        update: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken ?? null,
          expiresAt,
          profileId: userInfo.id || 'default',
          isActive: true,
          updatedAt: new Date(),
          profileName: userInfo.name || userInfo.username,
          metadata: {
            tokenType: tokenData.tokenType,
            userInfo,
          },
        },
        create: {
          userId: user.id,
          organizationId: loginOrgId || null,
          platform,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken ?? null,
          expiresAt,
          scope: '',
          profileId: userInfo.id || 'default',
          profileName: userInfo.name || userInfo.username,
          isActive: true,
          metadata: {
            tokenType: tokenData.tokenType,
            userInfo,
          },
        },
      });
    } catch (dbError) {
      console.error('Failed to store platform connection:', dbError);
      // Continue - user auth succeeded, just connection storage failed
    }

    // Owner bypass: force full access for platform owner(s)
    const ownerBypass = isOwnerEmail(user.email);
    const onboardingComplete = ownerBypass ? true : user.onboardingComplete;
    const apiKeyConfigured = ownerBypass ? true : user.apiKeyConfigured;

    // Auto-fix DB flags for owner on login (fire-and-forget)
    if (ownerBypass && (!user.onboardingComplete || !user.apiKeyConfigured)) {
      prisma.user.update({
        where: { id: user.id },
        data: { onboardingComplete: true, apiKeyConfigured: true },
      }).catch(() => { /* non-fatal */ });
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
    response.cookies.set('user-session', JSON.stringify({
      userId: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    }), {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    console.error('OAuth callback error:', error);

    // Try to determine if this was an integration flow to show popup error
    try {
      const state = new URL(request.url).searchParams.get('state');
      if (state) {
        const stateData = verifyAndDecodeState(state);
        if (stateData?.flow === 'integration') {
          const errorMsg = error instanceof Error ? error.message : 'Authentication failed';
          const html = buildPostMessageHtml('oauth-error', 'unknown', { error: errorMsg }, `OAuth error: ${errorMsg}`);
          return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
        }
      }
    } catch {
      // State parsing failed, fall through to redirect
    }

    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error instanceof Error ? error.message : 'Authentication failed')}`, request.url)
    );
  }
}

export const runtime = 'nodejs';
