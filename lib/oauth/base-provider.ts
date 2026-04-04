/**
 * Base OAuth Provider
 *
 * @description Abstract base class for OAuth providers
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - Each provider has its own CLIENT_ID and CLIENT_SECRET
 * - NEXT_PUBLIC_APP_URL: Application URL for callbacks
 * - OAUTH_STATE_SECRET: Secret key for HMAC state signing (CRITICAL)
 *
 * FAILURE MODE: Throws OAuthError on authentication failures
 */

import { createHmac, timingSafeEqual } from 'crypto';
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
// STATE MANAGEMENT - Secure Implementation with HMAC and Timestamp Expiration
// ============================================================================

/**
 * Secure OAuth State Manager
 *
 * SECURITY FEATURES:
 * - HMAC-SHA256 signature for cryptographic verification
 * - Timestamp-based expiration (10 minutes)
 * - Constant-time signature comparison to prevent timing attacks
 * - Detailed CSRF attempt logging
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - OAUTH_STATE_SECRET: 32+ character secret for HMAC signing (CRITICAL)
 */
export class OAuthStateManager {
  /** State expires after 10 minutes */
  private static readonly STATE_TTL_MS = 10 * 60 * 1000;

  /** HMAC algorithm */
  private static readonly HMAC_ALGORITHM = 'sha256';

  /**
   * Get the state signing secret from environment
   * @throws Error if secret is not configured
   */
  private static getStateSecret(): string {
    const secret = process.env.OAUTH_STATE_SECRET;

    if (!secret) {
      throw new Error(
        'OAUTH_STATE_SECRET environment variable is required for OAuth state signing. ' +
        'Generate with: openssl rand -base64 32'
      );
    }

    if (secret.length < 32) {
      throw new Error(
        'OAUTH_STATE_SECRET must be at least 32 characters for security. ' +
        'Generate with: openssl rand -base64 32'
      );
    }

    return secret;
  }

  /**
   * Generate HMAC signature for state data
   */
  private static signState(payload: Omit<OAuthState, 'signature'>): string {
    const secret = this.getStateSecret();
    const dataToSign = JSON.stringify({
      platform: payload.platform,
      userId: payload.userId,
      redirectTo: payload.redirectTo,
      nonce: payload.nonce,
      createdAt: payload.createdAt,
    });

    return createHmac(this.HMAC_ALGORITHM, secret)
      .update(dataToSign)
      .digest('base64url');
  }

  /**
   * Verify HMAC signature using constant-time comparison
   * @returns true if signature is valid, false otherwise
   */
  private static verifySignature(state: OAuthState, providedSignature: string): boolean {
    try {
      const expectedSignature = this.signState(state);

      // Use timing-safe comparison to prevent timing attacks
      const expected = Buffer.from(expectedSignature, 'utf8');
      const provided = Buffer.from(providedSignature, 'utf8');

      if (expected.length !== provided.length) {
        return false;
      }

      return timingSafeEqual(expected, provided);
    } catch {
      return false;
    }
  }

  /**
   * Generate a cryptographically signed OAuth state
   *
   * @param platform - The OAuth platform
   * @param userId - The user initiating the OAuth flow
   * @param redirectTo - Optional URL to redirect after OAuth completes
   * @returns Base64url encoded signed state string
   */
  static generateState(platform: OAuthPlatform, userId: string, redirectTo?: string): string {
    const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url');

    const statePayload: Omit<OAuthState, 'signature'> = {
      platform,
      userId,
      redirectTo,
      nonce,
      createdAt: Date.now(),
    };

    const signature = this.signState(statePayload);

    const signedState: OAuthState = {
      ...statePayload,
      signature,
    };

    return Buffer.from(JSON.stringify(signedState)).toString('base64url');
  }

  /**
   * Parse and validate OAuth state with full security checks
   *
   * Security validations performed:
   * 1. JSON parsing and structure validation
   * 2. Required field presence
   * 3. HMAC signature verification (cryptographic)
   * 4. Timestamp expiration check (10 minutes)
   *
   * @param stateString - The state parameter from OAuth callback
   * @returns Validated OAuthState object
   * @throws OAuthError if validation fails
   */
  static parseState(stateString: string): OAuthState {
    let parsedData: unknown;

    // Step 1: Decode and parse JSON
    try {
      const decoded = Buffer.from(stateString, 'base64url').toString('utf8');
      parsedData = JSON.parse(decoded);
    } catch {
      logger.warn('OAuth state decode/parse failed - potential CSRF attempt', {
        stateLength: stateString?.length,
        statePrefix: stateString?.substring(0, 20),
      });
      throw new OAuthError('twitter', 'INVALID_STATE', 'Invalid OAuth state format');
    }

    // Step 2: Validate structure and required fields
    const state = parsedData as OAuthState;

    if (!state || typeof state !== 'object') {
      logger.warn('OAuth state not an object - potential CSRF attempt');
      throw new OAuthError('twitter', 'INVALID_STATE', 'Invalid OAuth state structure');
    }

    if (!state.platform || !state.userId || !state.nonce || !state.createdAt) {
      logger.warn('OAuth state missing required fields - potential CSRF attempt', {
        hasPlataform: !!state.platform,
        hasUserId: !!state.userId,
        hasNonce: !!state.nonce,
        hasCreatedAt: !!state.createdAt,
      });
      throw new OAuthError(
        state.platform || 'twitter',
        'INVALID_STATE',
        'OAuth state missing required fields'
      );
    }

    // Step 3: Verify HMAC signature (cryptographic verification)
    if (!state.signature) {
      logger.warn('OAuth state missing signature - CSRF attempt detected', {
        platform: state.platform,
        userId: state.userId,
      });
      throw new OAuthError(state.platform, 'INVALID_STATE_SIGNATURE', 'OAuth state signature missing');
    }

    const isValidSignature = this.verifySignature(state, state.signature);

    if (!isValidSignature) {
      logger.error('OAuth state signature verification FAILED - CSRF ATTACK DETECTED', {
        platform: state.platform,
        userId: state.userId,
        createdAt: new Date(state.createdAt).toISOString(),
        clientIp: 'logged-separately', // Should be added from request context
      });
      throw new OAuthError(state.platform, 'INVALID_STATE_SIGNATURE', 'OAuth state signature invalid');
    }

    // Step 4: Check timestamp expiration (10 minutes)
    const stateAge = Date.now() - state.createdAt;

    if (stateAge > this.STATE_TTL_MS) {
      const ageMinutes = Math.floor(stateAge / 60000);
      logger.warn('OAuth state expired - potential replay attack', {
        platform: state.platform,
        userId: state.userId,
        createdAt: new Date(state.createdAt).toISOString(),
        ageMinutes,
        maxAgeMinutes: this.STATE_TTL_MS / 60000,
      });
      throw new OAuthError(
        state.platform,
        'STATE_EXPIRED',
        `OAuth state expired (age: ${ageMinutes} minutes, max: ${this.STATE_TTL_MS / 60000} minutes)`
      );
    }

    // Step 5: Check for future timestamps (clock skew attack)
    if (state.createdAt > Date.now() + 60000) { // Allow 1 minute clock skew
      logger.error('OAuth state has future timestamp - potential attack', {
        platform: state.platform,
        userId: state.userId,
        createdAt: new Date(state.createdAt).toISOString(),
        serverTime: new Date().toISOString(),
      });
      throw new OAuthError(state.platform, 'INVALID_STATE_TIMESTAMP', 'OAuth state has invalid timestamp');
    }

    logger.debug('OAuth state validated successfully', {
      platform: state.platform,
      userId: state.userId,
      stateAgeSeconds: Math.floor(stateAge / 1000),
    });

    return state;
  }

  /**
   * Check if a state string is valid without throwing
   * Useful for pre-validation checks
   */
  static isValidState(stateString: string): boolean {
    try {
      this.parseState(stateString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get remaining validity time for a state in milliseconds
   * Returns 0 if state is invalid or expired
   */
  static getRemainingValidity(stateString: string): number {
    try {
      const decoded = Buffer.from(stateString, 'base64url').toString('utf8');
      const state = JSON.parse(decoded) as OAuthState;
      const remaining = this.STATE_TTL_MS - (Date.now() - state.createdAt);
      return Math.max(0, remaining);
    } catch {
      return 0;
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { BaseOAuthProvider as default };
