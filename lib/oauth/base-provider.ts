/**
 * Base OAuth Provider
 *
 * @description Abstract base class for OAuth providers
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - Each provider has its own CLIENT_ID and CLIENT_SECRET
 * - NEXT_PUBLIC_APP_URL: Application URL for callbacks
 *
 * FAILURE MODE: Throws OAuthError on authentication failures
 */

import { logger } from '@/lib/logger';
import {
  OAuthPlatform,
  OAuthConfig,
  OAuthTokens,
  OAuthUserInfo,
  OAuthState,
  OAuthCallbackParams,
} from './types';

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class OAuthError extends Error {
  public platform: OAuthPlatform;
  public code: string;

  constructor(platform: OAuthPlatform, code: string, message: string) {
    super(message);
    this.name = 'OAuthError';
    this.platform = platform;
    this.code = code;
  }
}

// ============================================================================
// BASE PROVIDER
// ============================================================================

export abstract class BaseOAuthProvider {
  protected platform: OAuthPlatform;
  protected config: OAuthConfig;

  constructor(platform: OAuthPlatform, config: OAuthConfig) {
    this.platform = platform;
    this.config = config;
  }

  /**
   * Get the platform name
   */
  getPlatform(): OAuthPlatform {
    return this.platform;
  }

  /**
   * Check if credentials are configured
   */
  isConfigured(): boolean {
    return Boolean(this.config.clientId && this.config.clientSecret);
  }

  /**
   * Validate that credentials are configured (throws if not)
   */
  protected validateCredentials(): void {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new OAuthError(
        this.platform,
        'NOT_CONFIGURED',
        `${this.platform} OAuth credentials not configured`
      );
    }
  }

  /**
   * Generate authorization URL
   */
  getAuthorizationUrl(state: string, additionalParams?: Record<string, string>): string {
    this.validateCredentials();
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope.join(' '),
      state,
      ...additionalParams,
    });

    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    this.validateCredentials();
    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
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
        logger.error('Token exchange failed', { platform: this.platform, error });
        throw new OAuthError(this.platform, 'TOKEN_EXCHANGE_FAILED', 'Failed to exchange code for tokens');
      }

      const data = await response.json();
      return this.parseTokenResponse(data);
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Token exchange error', { platform: this.platform, error });
      throw new OAuthError(this.platform, 'TOKEN_EXCHANGE_ERROR', 'Error during token exchange');
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    this.validateCredentials();
    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
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
        logger.error('Token refresh failed', { platform: this.platform, error });
        throw new OAuthError(this.platform, 'TOKEN_REFRESH_FAILED', 'Failed to refresh access token');
      }

      const data = await response.json();
      return this.parseTokenResponse(data);
    } catch (error) {
      if (error instanceof OAuthError) throw error;
      logger.error('Token refresh error', { platform: this.platform, error });
      throw new OAuthError(this.platform, 'TOKEN_REFRESH_ERROR', 'Error during token refresh');
    }
  }

  /**
   * Revoke access token
   */
  async revokeToken(token: string): Promise<void> {
    // Override in subclasses if the platform supports token revocation
    logger.info('Token revocation not implemented', { platform: this.platform });
  }

  /**
   * Get user info from the platform
   */
  abstract getUserInfo(accessToken: string): Promise<OAuthUserInfo>;

  /**
   * Parse token response (can be overridden for platform-specific parsing)
   */
  protected parseTokenResponse(data: Record<string, unknown>): OAuthTokens {
    const expiresIn = data.expires_in as number | undefined;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;

    return {
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string | undefined,
      expiresAt,
      tokenType: data.token_type as string | undefined,
      scope: data.scope as string | undefined,
    };
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(tokens: OAuthTokens): boolean {
    if (!tokens.expiresAt) return false;
    // Consider expired 5 minutes before actual expiry
    return new Date(tokens.expiresAt).getTime() - 5 * 60 * 1000 < Date.now();
  }

  /**
   * Get tokens, refreshing if necessary
   */
  async getValidTokens(tokens: OAuthTokens): Promise<OAuthTokens> {
    if (!this.isTokenExpired(tokens)) {
      return tokens;
    }

    if (!tokens.refreshToken) {
      throw new OAuthError(this.platform, 'NO_REFRESH_TOKEN', 'Token expired and no refresh token available');
    }

    return this.refreshAccessToken(tokens.refreshToken);
  }
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

export class OAuthStateManager {
  private static readonly STATE_TTL = 10 * 60 * 1000; // 10 minutes

  /**
   * Generate OAuth state
   */
  static generateState(platform: OAuthPlatform, userId: string, redirectTo?: string): string {
    const state: OAuthState = {
      platform,
      userId,
      redirectTo,
      nonce: Math.random().toString(36).slice(2) + Date.now().toString(36),
      createdAt: Date.now(),
    };

    return Buffer.from(JSON.stringify(state)).toString('base64url');
  }

  /**
   * Parse and validate OAuth state
   */
  static parseState(stateString: string): OAuthState {
    try {
      const state = JSON.parse(Buffer.from(stateString, 'base64url').toString()) as OAuthState;

      // Validate state is not expired
      if (Date.now() - state.createdAt > this.STATE_TTL) {
        throw new Error('State expired');
      }

      return state;
    } catch (error) {
      throw new OAuthError('twitter', 'INVALID_STATE', 'Invalid or expired OAuth state');
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { BaseOAuthProvider as default };
