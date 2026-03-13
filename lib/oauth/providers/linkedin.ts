/**
 * LinkedIn OAuth Provider
 *
 * @description OAuth 2.0 implementation for LinkedIn
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - LINKEDIN_CLIENT_ID: LinkedIn API client ID
 * - LINKEDIN_CLIENT_SECRET: LinkedIn API client secret
 * - NEXT_PUBLIC_APP_URL: Application URL
 *
 * SCOPES: openid, profile, email, w_member_social
 */

import { BaseOAuthProvider, OAuthError } from '../base-provider';
import { OAuthConfig, OAuthUserInfo, OAuthTokens } from '../types';
import { logger } from '@/lib/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const getConfig = (): OAuthConfig => {
  const clientId = process.env.LINKEDIN_CLIENT_ID || '';
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/auth/linkedin/callback`,
    scope: ['openid', 'profile', 'email', 'w_member_social'],
    authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
  };
};

// ============================================================================
// LINKEDIN PROVIDER
// ============================================================================

export class LinkedInOAuthProvider extends BaseOAuthProvider {
  constructor() {
    super('linkedin', getConfig());
  }

  /**
   * Get user info from LinkedIn (OpenID Connect)
   */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    try {
      const response = await fetch(this.config.userInfoUrl!, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new OAuthError('linkedin', 'USER_INFO_FAILED', 'Failed to get user info');
      }

      const data = await response.json();

      return {
        id: data.sub,
        displayName: data.name,
        email: data.email,
        avatar: data.picture,
        // LinkedIn OIDC `sub` is a numeric internal ID, not the public vanity handle.
        // The vanity URL requires a separate REST API call; omit to avoid broken links.
        profileUrl: undefined,
        raw: data,
      };
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('LinkedIn user info error', { error });
      throw new OAuthError('linkedin', 'USER_INFO_ERROR', 'Error getting user info');
    }
  }

  /**
   * Get organization pages the user can manage
   */
  async getOrganizationPages(accessToken: string): Promise<Array<{ id: string; name: string }>> {
    try {
      // First get organizations the user is an admin of
      const response = await fetch(
        'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organizationalTarget~))',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      );

      if (!response.ok) {
        throw new OAuthError('linkedin', 'ORGANIZATIONS_FAILED', 'Failed to get organizations');
      }

      const data = await response.json();

      return (data.elements || []).map((element: { 'organizationalTarget~': { id: string; localizedName: string } }) => ({
        id: element['organizationalTarget~'].id,
        name: element['organizationalTarget~'].localizedName,
      }));
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('LinkedIn organizations error', { error });
      throw new OAuthError('linkedin', 'ORGANIZATIONS_ERROR', 'Error getting organizations');
    }
  }

  /**
   * Exchange code for tokens (LinkedIn specific)
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
          grant_type: 'authorization_code',
          code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('LinkedIn token exchange failed', { error });
        throw new OAuthError('linkedin', 'TOKEN_EXCHANGE_FAILED', 'Failed to exchange code for tokens');
      }

      const data = await response.json();
      return this.parseTokenResponse(data);
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('LinkedIn token exchange error', { error });
      throw new OAuthError('linkedin', 'TOKEN_EXCHANGE_ERROR', 'Error during token exchange');
    }
  }

  /**
   * Refresh access token
   * Note: LinkedIn access tokens are long-lived (60 days) but can be refreshed
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
        logger.error('LinkedIn token refresh failed', { error });
        throw new OAuthError('linkedin', 'TOKEN_REFRESH_FAILED', 'Failed to refresh access token');
      }

      const data = await response.json();
      return this.parseTokenResponse(data);
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('LinkedIn token refresh error', { error });
      throw new OAuthError('linkedin', 'TOKEN_REFRESH_ERROR', 'Error during token refresh');
    }
  }

  /**
   * Revoke token - LinkedIn doesn't have a revocation endpoint
   * Users must manually revoke via LinkedIn settings
   */
  override async revokeToken(_token: string): Promise<void> {
    logger.info('LinkedIn does not support programmatic token revocation');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const linkedinProvider = new LinkedInOAuthProvider();
export default LinkedInOAuthProvider;
