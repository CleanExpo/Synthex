/**
 * OAuth Callback Handler
 *
 * Handles OAuth callbacks from all supported platforms.
 * Processes authorization codes, exchanges for tokens, and creates/updates users.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (SECRET)
 * - GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET (SECRET)
 * - TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET (SECRET)
 * - LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET (SECRET)
 * - NEXT_PUBLIC_APP_URL (PUBLIC)
 * - JWT_SECRET (CRITICAL)
 * - FIELD_ENCRYPTION_KEY: 32-byte hex key for token encryption (CRITICAL)
 *
 * @module app/api/auth/callback/[platform]/route
 *
 * NOTE: OAuth tokens are encrypted at rest using AES-256-GCM
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { encryptField } from '@/lib/security/field-encryption';

// =============================================================================
// OAuth Configuration
// =============================================================================

interface OAuthConfig {
  tokenUrl: string;
  userInfoUrl: string;
  clientId: string | undefined;
  clientSecret: string | undefined;
  headers?: Record<string, string>;
}

const oauthConfigs: Record<string, OAuthConfig> = {
  google: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  github: {
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    headers: { Accept: 'application/json' },
  },
  twitter: {
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userInfoUrl: 'https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username',
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
  },
  linkedin: {
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  },
  facebook: {
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,email,picture',
    clientId: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
  },
};

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
  codeVerifier?: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
}> {
  const config = oauthConfigs[platform];
  if (!config || !config.clientId || !config.clientSecret) {
    throw new Error(`OAuth not configured for ${platform}`);
  }

  const params: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  };

  // Twitter requires PKCE code verifier
  if (platform === 'twitter' && codeVerifier) {
    params.code_verifier = codeVerifier;
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...config.headers,
    },
    body: new URLSearchParams(params).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Token exchange failed for ${platform}:`, error);
    throw new Error(`Failed to exchange code: ${error}`);
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
  accessToken: string
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

  const response = await fetch(config.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`User info fetch failed for ${platform}:`, error);
    throw new Error(`Failed to fetch user info: ${error}`);
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
    case 'github':
      // GitHub may not return email directly, need to fetch separately
      let email = data.email;
      if (!email) {
        try {
          const emailResponse = await fetch('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const emails = await emailResponse.json();
          email = emails.find((e: any) => e.primary)?.email;
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
    case 'twitter':
      return {
        id: data.data.id,
        name: data.data.name,
        avatar: data.data.profile_image_url,
        username: data.data.username,
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
    default:
      return {
        id: data.id || data.sub,
        email: data.email,
        name: data.name,
        avatar: data.picture || data.avatar_url,
      };
  }
}

/**
 * Generate JWT token for authenticated user
 * Uses centralized JWT utilities - no fallback secrets allowed
 */
function generateToken(user: { id: string; email: string; name?: string | null }): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required but not set');
  }

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    { expiresIn: '7d' }
  );
}

// =============================================================================
// Route Handler
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  try {
    const platform = params.platform.toLowerCase();
    const { searchParams } = new URL(request.url);

    // Check for OAuth error
    const error = searchParams.get('error');
    if (error) {
      const errorDescription = searchParams.get('error_description') || 'Authentication failed';
      console.error(`OAuth error for ${platform}:`, error, errorDescription);
      return NextResponse.redirect(
        new URL(`/auth/login?error=${encodeURIComponent(errorDescription)}`, request.url)
      );
    }

    // Get authorization code
    const code = searchParams.get('code');
    if (!code) {
      return NextResponse.redirect(
        new URL('/auth/login?error=No authorization code received', request.url)
      );
    }

    // Get and validate state
    const state = searchParams.get('state');
    if (!state) {
      return NextResponse.redirect(
        new URL('/auth/login?error=Invalid state parameter', request.url)
      );
    }

    // Decode state
    let stateData: { userId?: string; email?: string; platform: string; timestamp: number };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch {
      return NextResponse.redirect(
        new URL('/auth/login?error=Invalid state parameter', request.url)
      );
    }

    // Validate state timestamp (5 minute expiry)
    if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
      return NextResponse.redirect(
        new URL('/auth/login?error=Authentication session expired', request.url)
      );
    }

    // Check if platform is supported
    if (!oauthConfigs[platform]) {
      return NextResponse.redirect(
        new URL(`/auth/login?error=Unsupported OAuth provider: ${platform}`, request.url)
      );
    }

    // Build redirect URI - require NEXT_PUBLIC_APP_URL in production
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl && process.env.NODE_ENV === 'production') {
      return NextResponse.redirect(
        new URL('/auth/login?error=NEXT_PUBLIC_APP_URL must be configured', request.url)
      );
    }
    const redirectUri = `${appUrl || 'http://localhost:3000'}/api/auth/callback/${platform}`;

    // Get code verifier for Twitter PKCE
    const codeVerifier = searchParams.get('code_verifier');

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(platform, code, redirectUri, codeVerifier || undefined);

    // Fetch user info
    const userInfo = await fetchUserInfo(platform, tokenData.accessToken);

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          userInfo.email ? { email: userInfo.email } : {},
          { [`${platform}Id`]: userInfo.id },
        ].filter(Boolean),
      },
    });

    if (user) {
      // Update existing user with OAuth info
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          [`${platform}Id`]: userInfo.id,
          avatar: userInfo.avatar || user.avatar,
          name: userInfo.name || user.name,
          // Database expects Boolean for emailVerified
          emailVerified: true,
          updatedAt: new Date(),
        },
      });
    } else if (userInfo.email) {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: userInfo.email,
          name: userInfo.name || `${platform} User`,
          password: '', // Empty password for OAuth users
          [`${platform}Id`]: userInfo.id,
          avatar: userInfo.avatar,
          authProvider: platform,
          // Database expects Boolean for emailVerified
          emailVerified: true,
        },
      });
    } else {
      return NextResponse.redirect(
        new URL('/auth/login?error=Email not provided by OAuth provider', request.url)
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

      await prisma.platformConnection.upsert({
        where: {
          userId_platform_profileId: {
            userId: user.id,
            platform,
            profileId: userInfo.id || 'default',
          },
        },
        update: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken ?? null,
          expiresAt,
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
    } catch (error) {
      console.error('Failed to store platform connection:', error);
      // Continue - user auth succeeded, just connection storage failed
    }

    // Generate JWT token
    const token = generateToken(user);

    // Create response with redirect to dashboard
    const response = NextResponse.redirect(new URL('/dashboard', request.url));

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
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(error.message || 'Authentication failed')}`, request.url)
    );
  }
}

export const runtime = 'nodejs';
