import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { getPlatformOAuthCredentials } from '@/lib/platform-credentials';
import { generatePKCEChallenge, generateState, storePKCEState } from '@/lib/auth/pkce';
import crypto from 'crypto';

// OAuth configuration for different platforms (credentials loaded dynamically from DB)
const oauthConfig: Record<string, {
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  responseType?: string;
  accessType?: string;
  prompt?: string;
  codeChallengeMethod?: string;
  /** duration query param (Reddit-specific) */
  duration?: string;
}> = {
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userInfoUrl: 'https://api.twitter.com/2/users/me',
    scope: 'tweet.read tweet.write users.read offline.access',
    codeChallengeMethod: 'S256',
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    scope: 'openid profile email w_member_social',
  },
  instagram: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoUrl: 'https://graph.instagram.com/me',
    scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement',
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me',
    scope: 'public_profile,pages_show_list,pages_read_engagement,pages_manage_posts',
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    userInfoUrl: 'https://open.tiktokapis.com/v2/user/info/',
    scope: 'user.info.basic,video.list,video.upload',
  },
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    scope: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload',
    accessType: 'offline',
    prompt: 'consent',
  },
  pinterest: {
    authUrl: 'https://www.pinterest.com/oauth/',
    tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    userInfoUrl: 'https://api.pinterest.com/v5/user_account',
    scope: 'boards:read,pins:read,pins:write,user_accounts:read',
  },
  reddit: {
    authUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    userInfoUrl: 'https://oauth.reddit.com/api/v1/me',
    scope: 'identity read submit',
    duration: 'permanent',
  },
  threads: {
    authUrl: 'https://threads.net/oauth/authorize',
    tokenUrl: 'https://graph.threads.net/oauth/access_token',
    userInfoUrl: 'https://graph.threads.net/v1.0/me',
    scope: 'threads_basic,threads_content_publish,threads_read_replies',
  },
  // Google Analytics & Search integrations (use same GCP OAuth client as YouTube)
  searchconsole: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: 'https://www.googleapis.com/auth/webmasters.readonly profile email',
    accessType: 'offline',
    prompt: 'consent',
  },
  googleanalytics: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: 'https://www.googleapis.com/auth/analytics.readonly profile email',
    accessType: 'offline',
    prompt: 'consent',
  },
  // Google Drive — full access so clients can store all their content
  googledrive: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: 'https://www.googleapis.com/auth/drive profile email',
    accessType: 'offline',
    prompt: 'consent',
  },
};

/**
 * Sign state data with HMAC to prevent tampering.
 * Uses OAUTH_STATE_SECRET env var (falls back to JWT_SECRET).
 */
function signState(payload: string): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('OAUTH_STATE_SECRET or JWT_SECRET must be configured for OAuth');
  }
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

// GET - Initiate OAuth flow
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform: platformParam } = await params;
    const platform = platformParam.toLowerCase();

    if (!(platform in oauthConfig)) {
      return NextResponse.json(
        { error: 'Invalid platform', message: `"${platform}" is not a supported platform. Supported: ${Object.keys(oauthConfig).join(', ')}` },
        { status: 400 }
      );
    }

    const config = oauthConfig[platform];

    // Load credentials dynamically (checks DB first, falls back to env vars)
    const creds = await getPlatformOAuthCredentials(platform);
    if (!creds) {
      return NextResponse.json(
        { error: 'Platform not configured', message: `OAuth credentials for ${platform} have not been set up yet. Please configure them in Settings > Platform Credentials or set the environment variables.` },
        { status: 400 }
      );
    }

    // Get the current user (supports NextAuth sessions + JWT cookies)
    const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ);
    if (!security.allowed) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in to connect a platform.' }, { status: 401 });
    }
    const userId = security.context.userId!;

    // Look up user for state parameter
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get active organization for multi-business scoping
    const organizationId = await getEffectiveOrganizationId(userId);

    // Build redirect URL - require NEXT_PUBLIC_APP_URL in production
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Configuration error', message: 'NEXT_PUBLIC_APP_URL must be configured for OAuth in production.' },
        { status: 500 }
      );
    }
    const redirectUri = `${appUrl || 'http://localhost:3000'}/api/auth/callback/${platform}`;

    // Extract optional returnTo param — used by the platforms page to redirect back after OAuth
    const returnTo = request.nextUrl.searchParams.get('returnTo') ?? '/dashboard/settings?tab=integrations';

    // Generate HMAC-signed state parameter for security (includes org context)
    const statePayload = Buffer.from(JSON.stringify({
      userId: user.id,
      email: user.email,
      platform,
      organizationId: organizationId ?? null,
      timestamp: Date.now(),
      flow: 'integration',
      nonce: crypto.randomBytes(16).toString('hex'),
      returnTo,
    })).toString('base64url');
    const state = signState(statePayload);

    // Build authorization URL params
    const authParams = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.scope,
      state,
    });

    // Platform-specific params
    if (config.accessType) {
      authParams.set('access_type', config.accessType);
    }
    if (config.prompt) {
      authParams.set('prompt', config.prompt);
    }

    // Reddit requires "duration" param for refresh tokens
    if (config.duration) {
      authParams.set('duration', config.duration);
    }

    // TikTok uses client_key instead of client_id
    if (platform === 'tiktok') {
      authParams.delete('client_id');
      authParams.set('client_key', creds.clientId);
    }

    // Twitter requires PKCE (RFC 7636) - generate and store code verifier
    if (config.codeChallengeMethod === 'S256') {
      const pkce = generatePKCEChallenge();
      authParams.set('code_challenge', pkce.codeChallenge);
      authParams.set('code_challenge_method', 'S256');

      // Store the code verifier for the callback to retrieve
      await storePKCEState(
        state,
        pkce.codeVerifier,
        platform as Parameters<typeof storePKCEState>[2],
        redirectUri
      );
    }

    const authorizationUrl = `${config.authUrl}?${authParams.toString()}`;

    return NextResponse.json({
      authorizationUrl,
      platform,
      message: `Redirecting to ${platform} for authorization...`
    });
  } catch (error: unknown) {
    console.error('OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth', message: sanitizeErrorForResponse(error, 'OAuth operation failed') },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma + crypto
export const runtime = 'nodejs';
