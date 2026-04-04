/**
 * Threads OAuth Provider (Meta)
 *
 * @description OAuth 2.0 implementation for Threads (via Instagram Graph API)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - THREADS_APP_ID: Threads/Meta App ID
 * - THREADS_APP_SECRET: Threads/Meta App Secret
 * - NEXT_PUBLIC_APP_URL: Application URL
 *
 * SCOPES: threads_basic, threads_content_publish, threads_manage_insights
 */

import { BaseOAuthProvider, OAuthError } from '../base-provider';
import { OAuthConfig, OAuthUserInfo, OAuthTokens } from '../types';
import { logger } from '@/lib/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const getConfig = (): OAuthConfig => {
  const clientId = process.env.THREADS_APP_ID || '';
  const clientSecret = process.env.THREADS_APP_SECRET || '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/auth/threads/callback`,
    scope: ['threads_basic', 'threads_content_publish', 'threads_manage_insights'],
    authorizationUrl: 'https://threads.net/oauth/authorize',
    tokenUrl: 'https://graph.threads.net/oauth/access_token',
    userInfoUrl: 'https://graph.threads.net/v1.0/me',
  };
};

// ============================================================================
// THREADS PROVIDER
// ============================================================================

export class ThreadsOAuthProvider extends BaseOAuthProvider {
  constructor() {
    super('threads', getConfig());
  }

  /**
   * Exchange code for tokens
   */
  override async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    this.validateCredentials();
    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'authorization_code',
          redirect_uri: this.config.redirectUri,
          code,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Threads token exchange failed', { error });
        throw new OAuthError('threads', 'TOKEN_EXCHANGE_FAILED', 'Failed to exchange code for tokens');
      }

      const data = await response.json();
      return this.parseTokenResponse(data);
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Threads token exchange error', { error });
      throw new OAuthError('threads', 'TOKEN_EXCHANGE_ERROR', 'Error during token exchange');
    }
  }

  /**
   * Get long-lived access token (60 days)
   */
  async getLongLivedToken(shortLivedToken: string): Promise<OAuthTokens> {
    this.validateCredentials();
    try {
      const response = await fetch(
        `https://graph.threads.net/access_token?` +
        `grant_type=th_exchange_token&` +
        `client_secret=${this.config.clientSecret}&` +
        `access_token=${shortLivedToken}`
      );

      if (!response.ok) {
        throw new OAuthError('threads', 'LONG_LIVED_TOKEN_FAILED', 'Failed to get long-lived token');
      }

      const data = await response.json();
      return this.parseTokenResponse(data);
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Threads long-lived token error', { error });
      throw new OAuthError('threads', 'LONG_LIVED_TOKEN_ERROR', 'Error getting long-lived token');
    }
  }

  /**
   * Refresh access token
   */
  override async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    try {
      const response = await fetch(
        `https://graph.threads.net/refresh_access_token?` +
        `grant_type=th_refresh_token&` +
        `access_token=${refreshToken}`
      );

      if (!response.ok) {
        const error = await response.text();
        logger.error('Threads token refresh failed', { error });
        throw new OAuthError('threads', 'TOKEN_REFRESH_FAILED', 'Failed to refresh access token');
      }

      const data = await response.json();
      return this.parseTokenResponse(data);
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Threads token refresh error', { error });
      throw new OAuthError('threads', 'TOKEN_REFRESH_ERROR', 'Error during token refresh');
    }
  }

  /**
   * Get user info from Threads
   */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    try {
      const response = await fetch(
        `${this.config.userInfoUrl}?fields=id,username,threads_profile_picture_url,threads_biography&access_token=${accessToken}`
      );

      if (!response.ok) {
        throw new OAuthError('threads', 'USER_INFO_FAILED', 'Failed to get user info');
      }

      const data = await response.json();

      return {
        id: data.id,
        username: data.username,
        displayName: data.username,
        avatar: data.threads_profile_picture_url,
        profileUrl: `https://www.threads.net/@${data.username}`,
        raw: data,
      };
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Threads user info error', { error });
      throw new OAuthError('threads', 'USER_INFO_ERROR', 'Error getting user info');
    }
  }

  /**
   * Get user insights
   */
  async getInsights(
    accessToken: string,
    metrics: string[] = ['views', 'likes', 'replies', 'reposts', 'quotes']
  ): Promise<Record<string, number>> {
    try {
      const response = await fetch(
        `https://graph.threads.net/v1.0/me/threads_insights?` +
        `metric=${metrics.join(',')}&` +
        `access_token=${accessToken}`
      );

      if (!response.ok) {
        throw new OAuthError('threads', 'INSIGHTS_FAILED', 'Failed to get insights');
      }

      const data = await response.json();

      const insights: Record<string, number> = {};
      for (const item of data.data || []) {
        insights[item.name] = item.values?.[0]?.value || 0;
      }

      return insights;
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Threads insights error', { error });
      throw new OAuthError('threads', 'INSIGHTS_ERROR', 'Error getting insights');
    }
  }

  /**
   * Revoke token - Threads uses same endpoint as Meta
   */
  override async revokeToken(token: string): Promise<void> {
    try {
      await fetch(
        `https://graph.threads.net/me/permissions?access_token=${token}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      logger.error('Threads token revocation failed', { error });
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const threadsProvider = new ThreadsOAuthProvider();
export default ThreadsOAuthProvider;
