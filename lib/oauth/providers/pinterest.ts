/**
 * Pinterest OAuth Provider
 *
 * @description OAuth 2.0 implementation for Pinterest
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - PINTEREST_APP_ID: Pinterest App ID
 * - PINTEREST_APP_SECRET: Pinterest App Secret
 * - NEXT_PUBLIC_APP_URL: Application URL
 *
 * SCOPES: boards:read, boards:write, pins:read, pins:write, user_accounts:read
 */

import { BaseOAuthProvider, OAuthError } from '../base-provider';
import { OAuthConfig, OAuthUserInfo, OAuthTokens } from '../types';
import { logger } from '@/lib/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const getConfig = (): OAuthConfig => {
  const clientId = process.env.PINTEREST_APP_ID || '';
  const clientSecret = process.env.PINTEREST_APP_SECRET || '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/auth/pinterest/callback`,
    scope: ['boards:read', 'boards:write', 'pins:read', 'pins:write', 'user_accounts:read'],
    authorizationUrl: 'https://www.pinterest.com/oauth/',
    tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    userInfoUrl: 'https://api.pinterest.com/v5/user_account',
  };
};

// ============================================================================
// PINTEREST PROVIDER
// ============================================================================

export class PinterestOAuthProvider extends BaseOAuthProvider {
  constructor() {
    super('pinterest', getConfig());
  }

  /**
   * Exchange code for tokens (Pinterest requires Basic auth)
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
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Pinterest token exchange failed', { error });
        throw new OAuthError('pinterest', 'TOKEN_EXCHANGE_FAILED', 'Failed to exchange code for tokens');
      }

      const data = await response.json();
      return this.parseTokenResponse(data);
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Pinterest token exchange error', { error });
      throw new OAuthError('pinterest', 'TOKEN_EXCHANGE_ERROR', 'Error during token exchange');
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
        logger.error('Pinterest token refresh failed', { error });
        throw new OAuthError('pinterest', 'TOKEN_REFRESH_FAILED', 'Failed to refresh access token');
      }

      const data = await response.json();
      return this.parseTokenResponse(data);
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Pinterest token refresh error', { error });
      throw new OAuthError('pinterest', 'TOKEN_REFRESH_ERROR', 'Error during token refresh');
    }
  }

  /**
   * Get user info from Pinterest
   */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    try {
      const response = await fetch(this.config.userInfoUrl!, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new OAuthError('pinterest', 'USER_INFO_FAILED', 'Failed to get user info');
      }

      const data = await response.json();

      return {
        id: data.id,
        username: data.username,
        displayName: data.business_name || data.username,
        avatar: data.profile_image,
        profileUrl: `https://www.pinterest.com/${data.username}`,
        raw: data,
      };
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Pinterest user info error', { error });
      throw new OAuthError('pinterest', 'USER_INFO_ERROR', 'Error getting user info');
    }
  }

  /**
   * Get user's boards
   */
  async getBoards(accessToken: string): Promise<Array<{ id: string; name: string; privacy: string }>> {
    try {
      const response = await fetch('https://api.pinterest.com/v5/boards', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new OAuthError('pinterest', 'BOARDS_FAILED', 'Failed to get boards');
      }

      const data = await response.json();

      return (data.items || []).map((board: { id: string; name: string; privacy: string }) => ({
        id: board.id,
        name: board.name,
        privacy: board.privacy,
      }));
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Pinterest boards error', { error });
      throw new OAuthError('pinterest', 'BOARDS_ERROR', 'Error getting boards');
    }
  }

  /**
   * Revoke token - Pinterest doesn't have a public revocation endpoint
   */
  override async revokeToken(_token: string): Promise<void> {
    logger.info('Pinterest does not support programmatic token revocation');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const pinterestProvider = new PinterestOAuthProvider();
export default PinterestOAuthProvider;
