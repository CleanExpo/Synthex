/**
 * Base Platform Service Interface
 *
 * @description Defines the contract for all social media platform services
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - Platform-specific credentials (see individual service files)
 */

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
   * Check if service is properly configured
   */
  isConfigured(): boolean;

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
 * Abstract base class with common functionality
 */
export abstract class BasePlatformService implements PlatformService {
  abstract readonly platform: string;
  protected credentials: PlatformCredentials | null = null;
  protected rateLimits: Record<string, RateLimitInfo> = {};

  initialize(credentials: PlatformCredentials): void {
    this.credentials = credentials;
  }

  isConfigured(): boolean {
    return this.credentials !== null && !!this.credentials.accessToken;
  }

  abstract validateCredentials(): Promise<boolean>;
  abstract syncAnalytics(days?: number): Promise<SyncAnalyticsResult>;
  abstract syncPosts(limit?: number, cursor?: string): Promise<SyncPostsResult>;
  abstract syncProfile(): Promise<SyncProfileResult>;
  abstract createPost(content: PostContent): Promise<PostResult>;
  abstract deletePost(postId: string): Promise<boolean>;
  abstract getPostMetrics(postId: string): Promise<any>;

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
