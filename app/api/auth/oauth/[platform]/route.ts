import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import prisma from '@/lib/prisma';

// OAuth configuration for different platforms
const oauthConfig = {
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
    scope: 'tweet.read tweet.write users.read offline.access',
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    scope: 'r_liteprofile r_emailaddress w_member_social',
  },
  instagram: {
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    clientId: process.env.INSTAGRAM_CLIENT_ID,
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
    scope: 'user_profile,user_media',
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    clientId: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    scope: 'public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts',
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/auth/authorize/',
    tokenUrl: 'https://open-api.tiktok.com/oauth/access_token/',
    clientId: process.env.TIKTOK_CLIENT_KEY,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET,
    scope: 'user.info.basic,video.list,video.upload',
  },
};

// GET - Initiate OAuth flow
export async function GET(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  try {
    const platform = params.platform.toLowerCase() as keyof typeof oauthConfig;
    
    if (!(platform in oauthConfig)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }
    
    const config = oauthConfig[platform];

    if (!config.clientId) {
      return NextResponse.json(
        { error: `${platform} OAuth not configured. Please add ${platform.toUpperCase()}_CLIENT_ID to environment variables.` },
        { status: 500 }
      );
    }

    // Get the current user
    // Try header-based auth first; fallback to email param for static pages
    const authHeader = request.headers.get('authorization');
    let user: any = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data, error: authError } = await supabase.auth.getUser(token);
      if (!authError && data?.user) {
        user = data.user;
      }
    }
    if (!user) {
      const emailParam = new URL(request.url).searchParams.get('email');
      if (!emailParam) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      user = { id: null, email: emailParam };
    }

    // Generate state parameter for security
    const state = Buffer.from(JSON.stringify({
      userId: user?.id || null,
      email: user?.email || null,
      platform,
      timestamp: Date.now()
    })).toString('base64');

    // Build redirect URL
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/oauth/${platform}/callback`;

    // Build authorization URL
    const authParams = new URLSearchParams({
      client_id: config.clientId,
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
  } catch (error: any) {
    console.error('OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Handle OAuth callback
export async function POST(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  try {
    const platform = params.platform.toLowerCase() as keyof typeof oauthConfig;
    
    if (!(platform in oauthConfig)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }
    
    const config = oauthConfig[platform];

    const body = await request.json();
    const { code, state } = body;

    if (!code) {
      return NextResponse.json({ error: 'Authorization code missing' }, { status: 400 });
    }

    // Decode and verify state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch {
      return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 });
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/oauth/${platform}/callback`;

    // Exchange code for access token
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId!,
      client_secret: config.clientSecret!,
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
    } catch (e: any) {
      // On conflict (unique constraint), update existing record
      console.warn('PlatformConnection create failed, attempting updateMany:', e?.message || e);
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
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return NextResponse.json(
      { error: 'Failed to complete OAuth', details: error.message },
      { status: 500 }
    );
  }
}
