/**
 * Meta OAuth Provider (Facebook & Instagram)
 *
 * @description OAuth 2.0 implementation for Facebook and Instagram
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - META_CLIENT_ID: Meta App ID
 * - META_CLIENT_SECRET: Meta App Secret
 * - NEXT_PUBLIC_APP_URL: Application URL
 *
 * SCOPES:
 * - Facebook: public_profile, pages_manage_posts, pages_read_engagement
 * - Instagram: instagram_basic, instagram_content_publish
 */

import { BaseOAuthProvider, OAuthError } from '../base-provider';
import { OAuthConfig, OAuthUserInfo, OAuthTokens, OAuthPlatform } from '../types';
import { logger } from '@/lib/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const getConfig = (platform: 'facebook' | 'instagram'): OAuthConfig => {
  const clientId = process.env.META_CLIENT_ID || '';
  const clientSecret = process.env.META_CLIENT_SECRET || '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const scopes = platform === 'facebook'
    ? ['public_profile', 'pages_manage_posts', 'pages_read_engagement', 'pages_show_list']
    : ['instagram_basic', 'instagram_content_publish', 'instagram_manage_comments', 'pages_show_list'];

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/auth/${platform}/callback`,
    scope: scopes,
    authorizationUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/v18.0/me',
  };
};

// ============================================================================
// META PROVIDER
// ============================================================================

export class MetaOAuthProvider extends BaseOAuthProvider {
  private subPlatform: 'facebook' | 'instagram';

  constructor(platform: 'facebook' | 'instagram') {
    super(platform, getConfig(platform));
    this.subPlatform = platform;
  }

  /**
   * Get user info from Facebook/Instagram
   */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    try {
      const fields = 'id,name,email,picture';
      const response = await fetch(
        `${this.config.userInfoUrl}?fields=${fields}&access_token=${accessToken}`
      );

      if (!response.ok) {
        throw new OAuthError(this.platform, 'USER_INFO_FAILED', 'Failed to get user info');
      }

      const data = await response.json();

      return {
        id: data.id,
        displayName: data.name,
        email: data.email,
        avatar: data.picture?.data?.url,
        profileUrl: `https://www.facebook.com/${data.id}`,
        raw: data,
      };
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Meta user info error', { platform: this.platform, error });
      throw new OAuthError(this.platform, 'USER_INFO_ERROR', 'Error getting user info');
    }
  }

  /**
   * Get long-lived access token
   */
  async getLongLivedToken(shortLivedToken: string): Promise<OAuthTokens> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${this.config.clientId}&` +
        `client_secret=${this.config.clientSecret}&` +
        `fb_exchange_token=${shortLivedToken}`
      );

      if (!response.ok) {
        throw new OAuthError(this.platform, 'LONG_LIVED_TOKEN_FAILED', 'Failed to get long-lived token');
      }

      const data = await response.json();
      return this.parseTokenResponse(data);
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Meta long-lived token error', { platform: this.platform, error });
      throw new OAuthError(this.platform, 'LONG_LIVED_TOKEN_ERROR', 'Error getting long-lived token');
    }
  }

  /**
   * Get Instagram accounts connected to Facebook page
   */
  async getInstagramAccounts(accessToken: string, pageId: string): Promise<Array<{ id: string; username: string }>> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account{id,username}&access_token=${accessToken}`
      );

      if (!response.ok) {
        throw new OAuthError('instagram', 'INSTAGRAM_ACCOUNTS_FAILED', 'Failed to get Instagram accounts');
      }

      const data = await response.json();
      const igAccount = data.instagram_business_account;

      if (!igAccount) {
        return [];
      }

      return [{ id: igAccount.id, username: igAccount.username }];
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Instagram accounts error', { error });
      throw new OAuthError('instagram', 'INSTAGRAM_ACCOUNTS_ERROR', 'Error getting Instagram accounts');
    }
  }

  /**
   * Get Facebook pages managed by user
   */
  async getPages(accessToken: string): Promise<Array<{ id: string; name: string; accessToken: string }>> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
      );

      if (!response.ok) {
        throw new OAuthError('facebook', 'PAGES_FAILED', 'Failed to get Facebook pages');
      }

      const data = await response.json();
      return data.data.map((page: { id: string; name: string; access_token: string }) => ({
        id: page.id,
        name: page.name,
        accessToken: page.access_token,
      }));
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Facebook pages error', { error });
      throw new OAuthError('facebook', 'PAGES_ERROR', 'Error getting Facebook pages');
    }
  }

  /**
   * Revoke token
   */
  override async revokeToken(token: string): Promise<void> {
    try {
      await fetch(
        `https://graph.facebook.com/v18.0/me/permissions?access_token=${token}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      logger.error('Meta token revocation failed', { error });
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const facebookProvider = new MetaOAuthProvider('facebook');
export const instagramProvider = new MetaOAuthProvider('instagram');
export default MetaOAuthProvider;
