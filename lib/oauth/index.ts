/**
 * OAuth Module
 *
 * @description Unified OAuth provider exports and utilities
 *
 * SUPPORTED PLATFORMS:
 * - Twitter/X
 * - Facebook
 * - Instagram
 * - TikTok
 * - LinkedIn
 * - Pinterest
 * - YouTube
 * - Threads
 * - Reddit
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  OAuthPlatform,
  OAuthConfig,
  OAuthTokens,
  OAuthUserInfo,
  OAuthConnectionResult,
  OAuthState,
  OAuthCallbackParams,
} from './types';

// ============================================================================
// BASE EXPORTS
// ============================================================================

export { BaseOAuthProvider, OAuthError, OAuthStateManager } from './base-provider';

// ============================================================================
// PROVIDER EXPORTS
// ============================================================================

export { TwitterOAuthProvider, twitterProvider } from './providers/twitter';
export { MetaOAuthProvider, facebookProvider, instagramProvider } from './providers/meta';
export { TikTokOAuthProvider, tiktokProvider } from './providers/tiktok';
export { LinkedInOAuthProvider, linkedinProvider } from './providers/linkedin';
export { PinterestOAuthProvider, pinterestProvider } from './providers/pinterest';
export { YouTubeOAuthProvider, youtubeProvider } from './providers/youtube';
export { ThreadsOAuthProvider, threadsProvider } from './providers/threads';
export { RedditOAuthProvider, redditProvider } from './providers/reddit';

// ============================================================================
// PROVIDER REGISTRY
// ============================================================================

import { twitterProvider } from './providers/twitter';
import { facebookProvider, instagramProvider } from './providers/meta';
import { tiktokProvider } from './providers/tiktok';
import { linkedinProvider } from './providers/linkedin';
import { pinterestProvider } from './providers/pinterest';
import { youtubeProvider } from './providers/youtube';
import { threadsProvider } from './providers/threads';
import { redditProvider } from './providers/reddit';
import type { OAuthPlatform } from './types';
import type { BaseOAuthProvider } from './base-provider';

/**
 * Registry of all OAuth providers
 */
export const oauthProviders: Record<OAuthPlatform, BaseOAuthProvider> = {
  twitter: twitterProvider,
  facebook: facebookProvider,
  instagram: instagramProvider,
  tiktok: tiktokProvider,
  linkedin: linkedinProvider,
  pinterest: pinterestProvider,
  youtube: youtubeProvider,
  threads: threadsProvider,
  reddit: redditProvider,
};

/**
 * Get an OAuth provider by platform name
 */
export function getOAuthProvider(platform: OAuthPlatform): BaseOAuthProvider {
  const provider = oauthProviders[platform];
  if (!provider) {
    throw new Error(`Unknown OAuth platform: ${platform}`);
  }
  return provider;
}

/**
 * Check if a platform is supported
 */
export function isSupportedPlatform(platform: string): platform is OAuthPlatform {
  return platform in oauthProviders;
}

/**
 * Get list of all supported platforms
 */
export function getSupportedPlatforms(): OAuthPlatform[] {
  return Object.keys(oauthProviders) as OAuthPlatform[];
}

// ============================================================================
// OAUTH FLOW HELPERS
// ============================================================================

import { OAuthStateManager, OAuthError } from './base-provider';
import type { OAuthCallbackParams, OAuthConnectionResult } from './types';

/**
 * Start OAuth flow for a platform
 */
export function startOAuthFlow(
  platform: OAuthPlatform,
  userId: string,
  redirectTo?: string
): { url: string; state: string } {
  const provider = getOAuthProvider(platform);
  const state = OAuthStateManager.generateState(platform, userId, redirectTo);
  const url = provider.getAuthorizationUrl(state);

  return { url, state };
}

/**
 * Handle OAuth callback
 */
export async function handleOAuthCallback(
  params: OAuthCallbackParams
): Promise<OAuthConnectionResult> {
  // Parse and validate state
  const state = OAuthStateManager.parseState(params.state);

  // Check for errors from provider
  if (params.error) {
    throw new OAuthError(
      state.platform,
      params.error,
      params.errorDescription || 'OAuth authorization failed'
    );
  }

  // Ensure we have a code
  if (!params.code) {
    throw new OAuthError(state.platform, 'NO_CODE', 'No authorization code received');
  }

  // Get provider and exchange code for tokens
  const provider = getOAuthProvider(state.platform);
  const tokens = await provider.exchangeCodeForTokens(params.code);

  // Get user info
  const userInfo = await provider.getUserInfo(tokens.accessToken);

  return {
    platform: state.platform,
    tokens,
    userInfo,
  };
}

/**
 * Refresh tokens for a platform connection
 */
export async function refreshPlatformTokens(
  platform: OAuthPlatform,
  refreshToken: string
): Promise<import('./types').OAuthTokens> {
  const provider = getOAuthProvider(platform);
  return provider.refreshAccessToken(refreshToken);
}

/**
 * Revoke tokens for a platform connection
 */
export async function revokePlatformTokens(
  platform: OAuthPlatform,
  accessToken: string
): Promise<void> {
  const provider = getOAuthProvider(platform);
  await provider.revokeToken(accessToken);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  providers: oauthProviders,
  getProvider: getOAuthProvider,
  isSupportedPlatform,
  getSupportedPlatforms,
  startFlow: startOAuthFlow,
  handleCallback: handleOAuthCallback,
  refreshTokens: refreshPlatformTokens,
  revokeTokens: revokePlatformTokens,
};
