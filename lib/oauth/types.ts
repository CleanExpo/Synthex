/**
 * OAuth Types
 *
 * @description Shared types for OAuth providers
 */

export type OAuthPlatform =
  | 'twitter'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'linkedin'
  | 'pinterest'
  | 'youtube'
  | 'threads'
  | 'reddit';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
  scope?: string;
}

export interface OAuthUserInfo {
  id: string;
  username?: string;
  displayName?: string;
  email?: string;
  avatar?: string;
  profileUrl?: string;
  raw: Record<string, unknown>;
}

export interface OAuthConnectionResult {
  platform: OAuthPlatform;
  tokens: OAuthTokens;
  userInfo: OAuthUserInfo;
}

export interface OAuthState {
  platform: OAuthPlatform;
  userId: string;
  redirectTo?: string;
  nonce: string;
  createdAt: number;
  /** HMAC signature for cryptographic verification */
  signature?: string;
}

export interface OAuthCallbackParams {
  code?: string;
  state: string;
  error?: string;
  errorDescription?: string;
}
