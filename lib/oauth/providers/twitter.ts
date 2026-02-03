/**
 * Twitter/X OAuth Provider
 *
 * @description OAuth 2.0 implementation for Twitter/X
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - TWITTER_CLIENT_ID: Twitter API client ID
 * - TWITTER_CLIENT_SECRET: Twitter API client secret
 * - NEXT_PUBLIC_APP_URL: Application URL
 *
 * SCOPES: tweet.read, tweet.write, users.read, offline.access
 */

import { BaseOAuthProvider, OAuthError } from '../base-provider';
import { OAuthConfig, OAuthUserInfo, OAuthTokens } from '../types';
import { logger } from '@/lib/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const getConfig = (): OAuthConfig => {
  const clientId = process.env.TWITTER_CLIENT_ID || '';
  const clientSecret = process.env.TWITTER_CLIENT_SECRET || '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/auth/twitter/callback`,
    scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    authorizationUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userInfoUrl: 'https://api.twitter.com/2/users/me',
  };
};

// ============================================================================
// TWITTER PROVIDER
// ============================================================================

export class TwitterOAuthProvider extends BaseOAuthProvider {
  constructor() {
    super('twitter', getConfig());
  }

  /**
   * Generate authorization URL with PKCE
   */
  override getAuthorizationUrl(state: string): string {
    this.validateCredentials();
    const codeChallenge = this.generateCodeChallenge();

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'plain', // Use 'S256' in production with proper PKCE
    });

    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange code for tokens (Twitter requires Basic auth)
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
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.config.redirectUri,
          code_verifier: this.generateCodeChallenge(), // Must match code_challenge
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Twitter token exchange failed', { error });
        throw new OAuthError('twitter', 'TOKEN_EXCHANGE_FAILED', 'Failed to exchange code for tokens');
      }

      const data = await response.json();
      return this.parseTokenResponse(data);
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Twitter token exchange error', { error });
      throw new OAuthError('twitter', 'TOKEN_EXCHANGE_ERROR', 'Error during token exchange');
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
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Twitter token refresh failed', { error });
        throw new OAuthError('twitter', 'TOKEN_REFRESH_FAILED', 'Failed to refresh access token');
      }

      const data = await response.json();
      return this.parseTokenResponse(data);
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Twitter token refresh error', { error });
      throw new OAuthError('twitter', 'TOKEN_REFRESH_ERROR', 'Error during token refresh');
    }
  }

  /**
   * Get user info from Twitter
   */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    try {
      const response = await fetch(`${this.config.userInfoUrl}?user.fields=id,name,username,profile_image_url`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new OAuthError('twitter', 'USER_INFO_FAILED', 'Failed to get user info');
      }

      const { data } = await response.json();

      return {
        id: data.id,
        username: data.username,
        displayName: data.name,
        avatar: data.profile_image_url,
        profileUrl: `https://twitter.com/${data.username}`,
        raw: data,
      };
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Twitter user info error', { error });
      throw new OAuthError('twitter', 'USER_INFO_ERROR', 'Error getting user info');
    }
  }

  /**
   * Revoke token
   */
  override async revokeToken(token: string): Promise<void> {
    try {
      const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

      await fetch('https://api.twitter.com/2/oauth2/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          token,
          token_type_hint: 'access_token',
        }),
      });
    } catch (error) {
      logger.error('Twitter token revocation failed', { error });
    }
  }

  /**
   * Generate PKCE code challenge
   */
  private generateCodeChallenge(): string {
    // In production, use proper PKCE with crypto
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const twitterProvider = new TwitterOAuthProvider();
export default TwitterOAuthProvider;
