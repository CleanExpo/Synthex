/**
 * Base Platform Service Interface
 *
 * @description Defines the contract for all social media platform services
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - Platform-specific credentials (see individual service files)
 */

import { logger } from '@/lib/logger';

/**
 * Callback for persisting refreshed credentials to database
 */
export type TokenRefreshCallback = (
  platform: string,
  newCredentials: PlatformCredentials
) => Promise<void>;

export interface PlatformCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  platformUserId?: string;
  platformUsername?: string;
  scopes?: string[];
}

export interface SyncAnalyticsResult {
  success: boolean;
  metrics: {
    impressions: number;
    engagements: number;
    followers: number;
    following?: number;
    posts?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    reach?: number;
    profileViews?: number;
  };
  period: {
    start: Date;
    end: Date;
  };
  breakdown?: {
    daily?: Array<{
      date: string;
      impressions: number;
      engagements: number;
    }>;
    byPost?: Array<{
      postId: string;
      impressions: number;
      engagements: number;
    }>;
  };
  error?: string;
}

export interface SyncPostsResult {
  success: boolean;
  posts: Array<{
    id: string;
    platformId: string;
    content: string;
    mediaUrls?: string[];
    publishedAt: Date;
    metrics: {
      likes: number;
      comments: number;
      shares: number;
      impressions?: number;
      reach?: number;
    };
    url?: string;
  }>;
  total: number;
  hasMore: boolean;
  cursor?: string;
  error?: string;
}

export interface SyncProfileResult {
  success: boolean;
  profile: {
    id: string;
    username: string;
    displayName: string;
    bio?: string;
    avatarUrl?: string;
    coverUrl?: string;
    followers: number;
    following: number;
    postsCount: number;
    verified?: boolean;
    url?: string;
  };
  error?: string;
}

export interface PostContent {
  text: string;
  mediaUrls?: string[];
  mediaFiles?: Buffer[];
  linkUrl?: string;
  visibility?: 'public' | 'connections' | 'private';
  scheduledAt?: Date;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Audience Data Interfaces
// =============================================================================

export interface AudienceData {
  demographics: {
    ageRanges: Array<{ range: string; percentage: number }>;
    genderSplit: Array<{ gender: string; percentage: number }>;
    topLocations: Array<{ location: string; percentage: number }>;
  };
  behavior: {
    bestPostingTimes: Array<{ day: number; hour: number; engagement: number }>;
    activeHours: Array<{ hour: number; activity: number }>;
  };
}

export interface SyncAudienceResult {
  success: boolean;
  data?: AudienceData;
  error?: string;
}

export interface PostResult {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
}

export interface PlatformService {
  readonly platform: string;

  /**
   * Initialize service with user credentials
   */
  initialize(credentials: PlatformCredentials): void;

  /**
   * Set callback for persisting refreshed tokens to database
   */
  setTokenRefreshCallback(callback: TokenRefreshCallback): void;

  /**
   * Set custom token refresh threshold
   */
  setTokenRefreshThreshold(thresholdMs: number): void;

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean;

  /**
   * Check if token is expired or will expire soon
   */
  isTokenExpired(): boolean;

  /**
   * Check if token needs refresh
   */
  needsTokenRefresh(): boolean;

  /**
   * Get time until token expires in milliseconds
   */
  getTokenExpiryMs(): number;

  /**
   * Validate credentials are still valid
   */
  validateCredentials(): Promise<boolean>;

  /**
   * Refresh access token if needed
   */
  refreshToken?(): Promise<PlatformCredentials>;

  /**
   * Sync analytics data from platform
   */
  syncAnalytics(days?: number): Promise<SyncAnalyticsResult>;

  /**
   * Sync posts from platform
   */
  syncPosts(limit?: number, cursor?: string): Promise<SyncPostsResult>;

  /**
   * Sync profile information from platform
   */
  syncProfile(): Promise<SyncProfileResult>;

  /**
   * Create a new post
   */
  createPost(content: PostContent): Promise<PostResult>;

  /**
   * Delete a post
   */
  deletePost(postId: string): Promise<boolean>;

  /**
   * Get post metrics
   */
  getPostMetrics(postId: string): Promise<any>;

  /**
   * Sync audience demographics and behavior data from platform
   */
  syncAudience(): Promise<SyncAudienceResult>;
}

/**
 * Platform rate limit tracking
 */
export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
}

/**
 * Default token refresh threshold in milliseconds (5 minutes)
 */
const DEFAULT_TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Abstract base class with common functionality
 */
export abstract class BasePlatformService implements PlatformService {
  abstract readonly platform: string;
  protected credentials: PlatformCredentials | null = null;
  protected rateLimits: Record<string, RateLimitInfo> = {};
  protected tokenRefreshCallback: TokenRefreshCallback | null = null;
  protected tokenRefreshThresholdMs: number = DEFAULT_TOKEN_REFRESH_THRESHOLD_MS;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<PlatformCredentials> | null = null;

  initialize(credentials: PlatformCredentials): void {
    this.credentials = credentials;
  }

  /**
   * Set callback for persisting refreshed tokens
   * This should be called to enable automatic token persistence
   */
  setTokenRefreshCallback(callback: TokenRefreshCallback): void {
    this.tokenRefreshCallback = callback;
  }

  /**
   * Set custom token refresh threshold (how early before expiry to refresh)
   * @param thresholdMs Threshold in milliseconds (default: 5 minutes)
   */
  setTokenRefreshThreshold(thresholdMs: number): void {
    this.tokenRefreshThresholdMs = thresholdMs;
  }

  isConfigured(): boolean {
    return this.credentials !== null && !!this.credentials.accessToken;
  }

  /**
   * Check if token is expired or will expire within threshold
   */
  isTokenExpired(): boolean {
    if (!this.credentials?.expiresAt) {
      // If no expiry is set, assume token is valid
      return false;
    }

    const expiresAt = new Date(this.credentials.expiresAt).getTime();
    const now = Date.now();
    const threshold = this.tokenRefreshThresholdMs;

    return now >= expiresAt - threshold;
  }

  /**
   * Check if token needs refresh (expired or near expiry)
   */
  needsTokenRefresh(): boolean {
    if (!this.isConfigured()) {
      return false;
    }
    return this.isTokenExpired();
  }

  /**
   * Get time until token expires in milliseconds
   * Returns -1 if no expiry is set, 0 if already expired
   */
  getTokenExpiryMs(): number {
    if (!this.credentials?.expiresAt) {
      return -1;
    }

    const expiresAt = new Date(this.credentials.expiresAt).getTime();
    const now = Date.now();
    return Math.max(0, expiresAt - now);
  }

  /**
   * Ensure token is valid before making API calls
   * This should be called at the start of every API method
   * Handles concurrent refresh requests by reusing the same promise
   */
  protected async ensureValidToken(): Promise<void> {
    if (!this.needsTokenRefresh()) {
      return;
    }

    // Check if we can refresh (need refresh token capability)
    if (!this.canRefreshToken()) {
      const expiryInfo = this.credentials?.expiresAt
        ? `Token expires at ${this.credentials.expiresAt}`
        : 'Token expiry unknown';
      logger.warn(`[${this.platform}] Token needs refresh but no refresh capability. ${expiryInfo}`);
      return;
    }

    // Handle concurrent refresh requests - reuse existing promise
    if (this.isRefreshing && this.refreshPromise) {
      logger.debug(`[${this.platform}] Token refresh already in progress, waiting...`);
      await this.refreshPromise;
      return;
    }

    this.isRefreshing = true;
    logger.info(`[${this.platform}] Token expiring soon or expired, initiating refresh...`, {
      expiresAt: this.credentials?.expiresAt,
      expiryMs: this.getTokenExpiryMs(),
    });

    try {
      // Store promise so concurrent calls can wait on it
      if (!this.refreshToken) {
        throw new Error(`No refreshToken method implemented for ${this.platform}`);
      }
      this.refreshPromise = this.refreshToken();
      const newCredentials = await this.refreshPromise;

      // Persist refreshed credentials if callback is set
      if (this.tokenRefreshCallback) {
        try {
          await this.tokenRefreshCallback(this.platform, newCredentials);
          logger.info(`[${this.platform}] Refreshed credentials persisted successfully`);
        } catch (persistError) {
          logger.error(`[${this.platform}] Failed to persist refreshed credentials`, {
            error: persistError,
          });
          // Don't throw - we still have valid credentials in memory
        }
      }

      logger.info(`[${this.platform}] Token refreshed successfully`, {
        newExpiresAt: newCredentials.expiresAt,
      });
    } catch (error) {
      logger.error(`[${this.platform}] Token refresh failed`, { error });
      throw error;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Check if this service supports token refresh
   * Override in subclass if different logic needed
   */
  protected canRefreshToken(): boolean {
    // Default: can refresh if we have a refresh token or the subclass implements refreshToken
    return !!(this.credentials?.refreshToken || this.refreshToken);
  }

  /**
   * Refresh the access token - must be implemented by subclasses that support refresh
   */
  refreshToken?(): Promise<PlatformCredentials>;

  abstract validateCredentials(): Promise<boolean>;
  abstract syncAnalytics(days?: number): Promise<SyncAnalyticsResult>;
  abstract syncPosts(limit?: number, cursor?: string): Promise<SyncPostsResult>;
  abstract syncProfile(): Promise<SyncProfileResult>;
  abstract createPost(content: PostContent): Promise<PostResult>;
  abstract deletePost(postId: string): Promise<boolean>;
  abstract getPostMetrics(postId: string): Promise<any>;

  /**
   * Sync audience demographics and behavior data
   * Default implementation returns empty data - override for platform-specific APIs
   */
  async syncAudience(): Promise<SyncAudienceResult> {
    return {
      success: true,
      data: {
        demographics: {
          ageRanges: [],
          genderSplit: [],
          topLocations: [],
        },
        behavior: {
          bestPostingTimes: [],
          activeHours: [],
        },
      },
    };
  }

  /**
   * Check if we're rate limited for an endpoint
   */
  protected isRateLimited(endpoint: string): boolean {
    const limit = this.rateLimits[endpoint];
    if (!limit) return false;
    if (limit.remaining <= 0 && new Date() < limit.resetAt) {
      return true;
    }
    return false;
  }

  /**
   * Update rate limit info from response headers
   */
  protected updateRateLimits(endpoint: string, headers: Record<string, string>): void {
    const remaining = parseInt(headers['x-rate-limit-remaining'] || '100', 10);
    const limit = parseInt(headers['x-rate-limit-limit'] || '100', 10);
    const resetTime = parseInt(headers['x-rate-limit-reset'] || '0', 10);

    this.rateLimits[endpoint] = {
      remaining,
      limit,
      resetAt: new Date(resetTime * 1000),
    };
  }

  /**
   * Sleep utility for rate limiting
   */
  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry with exponential backoff
   */
  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const httpError = error as { status?: number };

        // Don't retry on auth errors
        if (httpError.status === 401 || httpError.status === 403) {
          throw error;
        }

        // Wait before retry
        const delay = baseDelay * Math.pow(2, attempt);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }
}

/**
 * Platform-specific error class
 */
export class PlatformError extends Error {
  constructor(
    public platform: string,
    message: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(`[${platform}] ${message}`);
    this.name = 'PlatformError';
  }
}
