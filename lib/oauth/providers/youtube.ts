/**
 * YouTube OAuth Provider (Google)
 *
 * @description OAuth 2.0 implementation for YouTube via Google
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - GOOGLE_CLIENT_ID: Google OAuth client ID
 * - GOOGLE_CLIENT_SECRET: Google OAuth client secret
 * - NEXT_PUBLIC_APP_URL: Application URL
 *
 * SCOPES: youtube.readonly, youtube.upload, youtube.force-ssl
 */

import { BaseOAuthProvider, OAuthError } from '../base-provider';
import { OAuthConfig, OAuthUserInfo, OAuthTokens } from '../types';
import { logger } from '@/lib/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const getConfig = (): OAuthConfig => {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/auth/youtube/callback`,
    scope: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.force-ssl',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  };
};

// ============================================================================
// YOUTUBE PROVIDER
// ============================================================================

export class YouTubeOAuthProvider extends BaseOAuthProvider {
  constructor() {
    super('youtube', getConfig());
  }

  /**
   * Generate authorization URL with offline access
   */
  override getAuthorizationUrl(state: string): string {
    this.validateCredentials();
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent', // Force consent to get refresh token
    });

    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Get user info from Google
   */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    try {
      const response = await fetch(this.config.userInfoUrl!, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new OAuthError('youtube', 'USER_INFO_FAILED', 'Failed to get user info');
      }

      const data = await response.json();

      return {
        id: data.id,
        displayName: data.name,
        email: data.email,
        avatar: data.picture,
        profileUrl: `https://www.youtube.com/channel/${data.id}`,
        raw: data,
      };
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('YouTube user info error', { error });
      throw new OAuthError('youtube', 'USER_INFO_ERROR', 'Error getting user info');
    }
  }

  /**
   * Get YouTube channel info
   */
  async getChannelInfo(accessToken: string): Promise<{ id: string; title: string; subscriberCount: string }> {
    try {
      const response = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new OAuthError('youtube', 'CHANNEL_INFO_FAILED', 'Failed to get channel info');
      }

      const data = await response.json();
      const channel = data.items?.[0];

      if (!channel) {
        throw new OAuthError('youtube', 'NO_CHANNEL', 'No YouTube channel found');
      }

      return {
        id: channel.id,
        title: channel.snippet.title,
        subscriberCount: channel.statistics.subscriberCount,
      };
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('YouTube channel info error', { error });
      throw new OAuthError('youtube', 'CHANNEL_INFO_ERROR', 'Error getting channel info');
    }
  }

  /**
   * Refresh access token
   */
  override async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    this.validateCredentials();
    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('YouTube token refresh failed', { error });
        throw new OAuthError('youtube', 'TOKEN_REFRESH_FAILED', 'Failed to refresh access token');
      }

      const data = await response.json();

      // Google doesn't return a new refresh token on refresh
      return {
        ...this.parseTokenResponse(data),
        refreshToken, // Keep the original refresh token
      };
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('YouTube token refresh error', { error });
      throw new OAuthError('youtube', 'TOKEN_REFRESH_ERROR', 'Error during token refresh');
    }
  }

  /**
   * Revoke token
   */
  override async revokeToken(token: string): Promise<void> {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      logger.error('YouTube token revocation failed', { error });
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const youtubeProvider = new YouTubeOAuthProvider();
export default YouTubeOAuthProvider;
