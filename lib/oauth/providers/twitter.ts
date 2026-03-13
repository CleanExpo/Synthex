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
import crypto from 'crypto';

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
  /**
   * Stores the PKCE code verifier between getAuthorizationUrl() and exchangeCodeForTokens().
   *
   * NOTE: This singleton approach is safe only for sequential single-user flows.
   * The main Synthex OAuth flow (app/api/auth/oauth + app/api/auth/callback) stores
   * PKCE state server-side (OAuthPKCEState table) and does NOT use this class at all.
   * This provider is used only when constructing auth URLs outside the main flow.
   */
  private _pkceVerifier: string | null = null;

  constructor() {
    super('twitter', getConfig());
  }

  /**
   * Generate a cryptographically secure PKCE code verifier and challenge pair.
   * Per RFC 7636: verifier = 32 random bytes base64url-encoded (43 chars).
   * Challenge = BASE64URL(SHA256(verifier)), method = S256.
   */
  private generatePKCEPair(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return { codeVerifier, codeChallenge };
  }

  /**
   * Generate authorization URL with PKCE (S256 method per RFC 7636)
   */
  override getAuthorizationUrl(state: string): string {
    this.validateCredentials();
    const { codeVerifier, codeChallenge } = this.generatePKCEPair();
    // Store verifier for use in exchangeCodeForTokens()
    this._pkceVerifier = codeVerifier;

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange code for tokens (Twitter requires Basic auth + PKCE code verifier)
   */
  override async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    this.validateCredentials();
    const codeVerifier = this._pkceVerifier;
    this._pkceVerifier = null; // clear after use — one-shot

    if (!codeVerifier) {
      throw new OAuthError('twitter', 'PKCE_MISSING', 'Call getAuthorizationUrl() before exchangeCodeForTokens()');
    }

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
          code_verifier: codeVerifier,
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

}

// ============================================================================
// EXPORTS
// ============================================================================

export const twitterProvider = new TwitterOAuthProvider();
export default TwitterOAuthProvider;
