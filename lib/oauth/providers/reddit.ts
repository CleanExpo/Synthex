/**
 * Reddit OAuth Provider
 *
 * @description OAuth 2.0 implementation for Reddit
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - REDDIT_CLIENT_ID: Reddit API client ID
 * - REDDIT_CLIENT_SECRET: Reddit API client secret
 * - NEXT_PUBLIC_APP_URL: Application URL
 *
 * SCOPES: identity, read, submit, edit, history
 */

import { BaseOAuthProvider, OAuthError } from '../base-provider';
import { OAuthConfig, OAuthUserInfo, OAuthTokens } from '../types';
import { logger } from '@/lib/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const getConfig = (): OAuthConfig => {
  const clientId = process.env.REDDIT_CLIENT_ID || '';
  const clientSecret = process.env.REDDIT_CLIENT_SECRET || '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/auth/reddit/callback`,
    scope: ['identity', 'read', 'submit', 'edit', 'history'],
    authorizationUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    userInfoUrl: 'https://oauth.reddit.com/api/v1/me',
  };
};

// ============================================================================
// REDDIT PROVIDER
// ============================================================================

export class RedditOAuthProvider extends BaseOAuthProvider {
  constructor() {
    super('reddit', getConfig());
  }

  /**
   * Generate authorization URL with duration=permanent
   */
  override getAuthorizationUrl(state: string): string {
    this.validateCredentials();
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope.join(' '),
      state,
      duration: 'permanent', // Get refresh token
    });

    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange code for tokens (Reddit requires Basic auth)
   */
  override async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    this.validateCredentials();
    try {
      const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
          'User-Agent': 'Synthex/1.0.0',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.config.redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Reddit token exchange failed', { error });
        throw new OAuthError('reddit', 'TOKEN_EXCHANGE_FAILED', 'Failed to exchange code for tokens');
      }

      const data = await response.json();
      return this.parseTokenResponse(data);
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Reddit token exchange error', { error });
      throw new OAuthError('reddit', 'TOKEN_EXCHANGE_ERROR', 'Error during token exchange');
    }
  }

  /**
   * Refresh access token
   */
  override async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    this.validateCredentials();
    try {
      const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
          'User-Agent': 'Synthex/1.0.0',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Reddit token refresh failed', { error });
        throw new OAuthError('reddit', 'TOKEN_REFRESH_FAILED', 'Failed to refresh access token');
      }

      const data = await response.json();

      // Reddit returns a new refresh token
      return this.parseTokenResponse(data);
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Reddit token refresh error', { error });
      throw new OAuthError('reddit', 'TOKEN_REFRESH_ERROR', 'Error during token refresh');
    }
  }

  /**
   * Get user info from Reddit
   */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    try {
      const response = await fetch(this.config.userInfoUrl!, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'Synthex/1.0.0',
        },
      });

      if (!response.ok) {
        throw new OAuthError('reddit', 'USER_INFO_FAILED', 'Failed to get user info');
      }

      const data = await response.json();

      return {
        id: data.id,
        username: data.name,
        displayName: data.name,
        avatar: data.icon_img?.split('?')[0], // Remove query params from avatar URL
        profileUrl: `https://www.reddit.com/user/${data.name}`,
        raw: data,
      };
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Reddit user info error', { error });
      throw new OAuthError('reddit', 'USER_INFO_ERROR', 'Error getting user info');
    }
  }

  /**
   * Get user's subreddits
   */
  async getSubreddits(accessToken: string): Promise<Array<{ name: string; subscribers: number; type: string }>> {
    try {
      const response = await fetch('https://oauth.reddit.com/subreddits/mine/subscriber?limit=100', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'Synthex/1.0.0',
        },
      });

      if (!response.ok) {
        throw new OAuthError('reddit', 'SUBREDDITS_FAILED', 'Failed to get subreddits');
      }

      const data = await response.json();

      return (data.data?.children || []).map((child: { data: { display_name: string; subscribers: number; subreddit_type: string } }) => ({
        name: child.data.display_name,
        subscribers: child.data.subscribers,
        type: child.data.subreddit_type,
      }));
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Reddit subreddits error', { error });
      throw new OAuthError('reddit', 'SUBREDDITS_ERROR', 'Error getting subreddits');
    }
  }

  /**
   * Get user's karma breakdown
   */
  async getKarma(accessToken: string): Promise<{ linkKarma: number; commentKarma: number; total: number }> {
    try {
      const response = await fetch('https://oauth.reddit.com/api/v1/me/karma', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'Synthex/1.0.0',
        },
      });

      if (!response.ok) {
        throw new OAuthError('reddit', 'KARMA_FAILED', 'Failed to get karma');
      }

      const data = await response.json();

      let linkKarma = 0;
      let commentKarma = 0;

      for (const item of data.data || []) {
        linkKarma += item.link_karma || 0;
        commentKarma += item.comment_karma || 0;
      }

      return {
        linkKarma,
        commentKarma,
        total: linkKarma + commentKarma,
      };
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Reddit karma error', { error });
      throw new OAuthError('reddit', 'KARMA_ERROR', 'Error getting karma');
    }
  }

  /**
   * Revoke token
   */
  override async revokeToken(token: string): Promise<void> {
    try {
      const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

      await fetch('https://www.reddit.com/api/v1/revoke_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
          'User-Agent': 'Synthex/1.0.0',
        },
        body: new URLSearchParams({
          token,
          token_type_hint: 'access_token',
        }),
      });
    } catch (error) {
      logger.error('Reddit token revocation failed', { error });
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const redditProvider = new RedditOAuthProvider();
export default RedditOAuthProvider;
