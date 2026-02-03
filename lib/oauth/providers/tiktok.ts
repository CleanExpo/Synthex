/**
 * TikTok OAuth Provider
 *
 * @description OAuth 2.0 implementation for TikTok
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - TIKTOK_CLIENT_KEY: TikTok API client key
 * - TIKTOK_CLIENT_SECRET: TikTok API client secret
 * - NEXT_PUBLIC_APP_URL: Application URL
 *
 * SCOPES: user.info.basic, video.list, video.upload
 */

import { BaseOAuthProvider, OAuthError } from '../base-provider';
import { OAuthConfig, OAuthUserInfo, OAuthTokens } from '../types';
import { logger } from '@/lib/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const getConfig = (): OAuthConfig => {
  const clientId = process.env.TIKTOK_CLIENT_KEY || '';
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET || '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/auth/tiktok/callback`,
    scope: ['user.info.basic', 'video.list', 'video.upload'],
    authorizationUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    userInfoUrl: 'https://open.tiktokapis.com/v2/user/info/',
  };
};

// ============================================================================
// TIKTOK PROVIDER
// ============================================================================

export class TikTokOAuthProvider extends BaseOAuthProvider {
  constructor() {
    super('tiktok', getConfig());
  }

  /**
   * Generate authorization URL with PKCE
   */
  override getAuthorizationUrl(state: string): string {
    this.validateCredentials();
    const codeVerifier = this.generateCodeVerifier();

    const params = new URLSearchParams({
      client_key: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope.join(','),
      state,
      code_challenge: codeVerifier, // TikTok uses plain code challenge
      code_challenge_method: 'S256',
    });

    return `${this.config.authorizationUrl}?${params.toString()}`;
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
          client_key: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.config.redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('TikTok token exchange failed', { error });
        throw new OAuthError('tiktok', 'TOKEN_EXCHANGE_FAILED', 'Failed to exchange code for tokens');
      }

      const data = await response.json();

      if (data.error) {
        throw new OAuthError('tiktok', data.error, data.error_description || 'Token exchange failed');
      }

      return this.parseTokenResponse(data);
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('TikTok token exchange error', { error });
      throw new OAuthError('tiktok', 'TOKEN_EXCHANGE_ERROR', 'Error during token exchange');
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
          client_key: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('TikTok token refresh failed', { error });
        throw new OAuthError('tiktok', 'TOKEN_REFRESH_FAILED', 'Failed to refresh access token');
      }

      const data = await response.json();
      return this.parseTokenResponse(data);
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('TikTok token refresh error', { error });
      throw new OAuthError('tiktok', 'TOKEN_REFRESH_ERROR', 'Error during token refresh');
    }
  }

  /**
   * Get user info from TikTok
   */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    try {
      const response = await fetch(
        `${this.config.userInfoUrl}?fields=open_id,union_id,avatar_url,display_name`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new OAuthError('tiktok', 'USER_INFO_FAILED', 'Failed to get user info');
      }

      const { data } = await response.json();

      return {
        id: data.user.open_id,
        displayName: data.user.display_name,
        avatar: data.user.avatar_url,
        profileUrl: `https://www.tiktok.com/@${data.user.display_name}`,
        raw: data,
      };
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('TikTok user info error', { error });
      throw new OAuthError('tiktok', 'USER_INFO_ERROR', 'Error getting user info');
    }
  }

  /**
   * Revoke token
   */
  override async revokeToken(token: string): Promise<void> {
    try {
      await fetch('https://open.tiktokapis.com/v2/oauth/revoke/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_key: this.config.clientId,
          client_secret: this.config.clientSecret,
          token,
        }),
      });
    } catch (error) {
      logger.error('TikTok token revocation failed', { error });
    }
  }

  /**
   * Parse TikTok token response
   */
  protected override parseTokenResponse(data: Record<string, unknown>): OAuthTokens {
    const expiresIn = data.expires_in as number | undefined;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;

    return {
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string | undefined,
      expiresAt,
      tokenType: data.token_type as string | undefined,
      scope: (data.scope as string) || this.config.scope.join(','),
    };
  }

  /**
   * Generate PKCE code verifier
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const tiktokProvider = new TikTokOAuthProvider();
export default TikTokOAuthProvider;
