import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { getPlatformOAuthCredentials } from '@/lib/platform-credentials';

const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

// OAuth configuration for different platforms (credentials loaded dynamically from DB)
const oauthConfig = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: 'openid email profile',
    responseType: 'code',
    accessType: 'offline',
    prompt: 'consent',
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scope: 'read:user user:email',
  },
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
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    userInfoUrl: 'https://graph.instagram.com/me',
    scope: 'user_profile,user_media',
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me',
    scope: 'public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts',
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
  },
  threads: {
    authUrl: 'https://threads.net/oauth/authorize',
    tokenUrl: 'https://graph.threads.net/oauth/access_token',
    userInfoUrl: 'https://graph.threads.net/v1.0/me',
    scope: 'threads_basic,threads_content_publish,threads_read_replies',
  },
};

// GET - Initiate OAuth flow
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform: platformParam } = await params;
    const platform = platformParam.toLowerCase() as keyof typeof oauthConfig;
    
    if (!(platform in oauthConfig)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }
    
    const config = oauthConfig[platform];

    // Load credentials dynamically (checks DB first, falls back to env vars)
    const creds = await getPlatformOAuthCredentials(platform);
    if (!creds) {
      return NextResponse.json(
        { error: 'Platform not configured', message: 'This platform connection has not been set up yet. Please contact your administrator.' },
        { status: 400 }
      );
    }

    // Get the current user from JWT cookie (same auth method as all other API routes)
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Generate state parameter for security (includes org context)
    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      email: user.email,
      platform,
      organizationId: organizationId ?? null,
      timestamp: Date.now(),
      flow: 'integration',
    })).toString('base64');

    // Build redirect URL - require NEXT_PUBLIC_APP_URL in production
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_APP_URL must be configured for OAuth' },
        { status: 500 }
      );
    }
    const redirectUri = `${appUrl || 'http://localhost:3000'}/api/auth/callback/${platform}`;

    // Build authorization URL
    const authParams = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.scope,
      state,
    });

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

// POST - Handle OAuth callback
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform: platformParam } = await params;
    const platform = platformParam.toLowerCase() as keyof typeof oauthConfig;
    
    if (!(platform in oauthConfig)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }
    
    const config = oauthConfig[platform];

    // Load credentials dynamically (checks DB first, falls back to env vars)
    const creds = await getPlatformOAuthCredentials(platform);
    if (!creds) {
      return NextResponse.json(
        { error: 'Platform not configured', message: 'This platform connection has not been set up yet. Please contact your administrator.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = oauthCallbackSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { code, state } = validation.data;

    // Decode and verify state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch {
      return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 });
    }

    // Build redirect URL - require NEXT_PUBLIC_APP_URL in production
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_APP_URL must be configured for OAuth' },
        { status: 500 }
      );
    }
    const redirectUri = `${appUrl || 'http://localhost:3000'}/api/auth/callback/${platform}`;

    // Exchange code for access token
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    });

    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Failed to exchange code for token: ${error}`);
    }

    const tokenData = await tokenResponse.json();

    // Persist the integration using Prisma PlatformConnection
    // Try to create; if unique conflict occurs, update existing
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;
    const scope = tokenData.scope || oauthConfig[platform].scope;
    const profileId = tokenData.user_id || tokenData.resource_owner_id || null; // fallback if provided by provider

    // Resolve userId (fallback to email) if missing
    let userId = stateData.userId;
    if (!userId && stateData.email && process.env.DATABASE_URL) {
      const u = await prisma.user.upsert({
        where: { email: stateData.email },
        update: {},
        create: { email: stateData.email, password: '!', name: stateData.email },
        select: { id: true }
      });
      userId = u.id;
    }

    try {
      await prisma.platformConnection.create({
        data: {
          userId,
          platform,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || null,
          expiresAt,
          scope,
          profileId,
          profileName: null,
          isActive: true,
          lastSync: null,
          metadata: {
            token_type: tokenData.token_type,
            raw: tokenData,
          },
        },
      });
    } catch (e: unknown) {
      // On conflict (unique constraint), update existing record
      console.warn('PlatformConnection create failed, attempting updateMany:', e instanceof Error ? e.message : e);
      await prisma.platformConnection.updateMany({
        where: { userId: stateData.userId, platform },
        data: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || null,
          expiresAt,
          scope,
          isActive: true,
          updatedAt: new Date(),
          metadata: {
            token_type: tokenData.token_type,
            raw: tokenData,
          } as any,
        },
      });
    }

    return NextResponse.json({
      success: true,
      platform,
      message: `Successfully connected to ${platform}`,
      hasToken: !!tokenData.access_token,
    });
  } catch (error: unknown) {
    console.error('OAuth callback error:', error);
    return NextResponse.json(
      { error: 'Failed to complete OAuth', message: sanitizeErrorForResponse(error, 'OAuth operation failed') },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
