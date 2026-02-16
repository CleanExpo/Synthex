/**
 * TikTok Platform Service
 *
 * @description TikTok API integration via TikTok Content Posting API v2
 * Supports video posting, analytics sync, and profile management
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - TIKTOK_CLIENT_KEY: TikTok app client key (SECRET)
 * - TIKTOK_CLIENT_SECRET: TikTok app client secret (SECRET)
 *
 * User credentials are stored per-user in the database (PlatformConnection)
 *
 * FAILURE MODE: Service will return error results, never throws for sync operations
 */

import {
  BasePlatformService,
  PlatformCredentials,
  SyncAnalyticsResult,
  SyncPostsResult,
  SyncProfileResult,
  PostContent,
  PostResult,
  PlatformError,
} from './base-platform-service';
import { logger } from '@/lib/logger';

// ============================================================================
// TIKTOK API RESPONSE TYPES
// ============================================================================

/** TikTok API base response wrapper */
interface TikTokApiResponse<T = unknown> {
  data?: T;
  error?: {
    code: string;
    message: string;
    log_id?: string;
  };
}

/** TikTok user info response */
interface TikTokUserInfo {
  user?: {
    open_id: string;
    union_id?: string;
    avatar_url?: string;
    display_name?: string;
    follower_count?: number;
    following_count?: number;
    likes_count?: number;
    video_count?: number;
    bio_description?: string;
    profile_deep_link?: string;
    is_verified?: boolean;
  };
}

/** TikTok video list response */
interface TikTokVideoListResponse {
  videos?: TikTokVideo[];
  cursor?: number;
  has_more?: boolean;
}

/** TikTok video element */
interface TikTokVideo {
  id: string;
  title?: string;
  video_description?: string;
  create_time?: number;
  cover_image_url?: string;
  share_url?: string;
  duration?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
}

/** TikTok video query response */
interface TikTokVideoQueryResponse {
  videos?: TikTokVideo[];
}

/** TikTok publish init response */
interface TikTokPublishInitResponse {
  publish_id?: string;
}

/** TikTok post metrics */
interface TikTokPostMetrics {
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

// ============================================================================
// SERVICE
// ============================================================================

export class TikTokService extends BasePlatformService {
  readonly platform = 'tiktok';

  /**
   * Make an authenticated request to the TikTok API
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<TikTokApiResponse<T>> {
    // Ensure token is valid before making request (auto-refresh if needed)
    await this.ensureValidToken();

    if (!this.credentials?.accessToken) {
      throw new PlatformError('tiktok', 'No access token configured');
    }

    const url = `${TIKTOK_API_BASE}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });

      // Update rate limits from response headers
      const rateLimitHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        if (key.startsWith('x-rate-limit')) {
          rateLimitHeaders[key] = value;
        }
      });
      if (Object.keys(rateLimitHeaders).length > 0) {
        this.updateRateLimits(endpoint, rateLimitHeaders);
      }

      const data: TikTokApiResponse<T> = await response.json();

      // Handle token expired errors — attempt refresh and retry
      if (data.error?.code === 'access_token_invalid' || response.status === 401) {
        logger.warn('[tiktok] Token expired during request, attempting refresh...', {
          errorCode: data.error?.code,
        });

        try {
          await this.refreshToken();

          // Retry the request with new token
          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              Authorization: `Bearer ${this.credentials.accessToken}`,
              'Content-Type': 'application/json',
              ...(options.headers || {}),
            },
          });

          const retryData: TikTokApiResponse<T> = await retryResponse.json();

          if (!retryResponse.ok || retryData.error) {
            throw new PlatformError(
              'tiktok',
              retryData.error?.message || `API request failed after token refresh: ${retryResponse.status}`,
              retryResponse.status
            );
          }

          return retryData;
        } catch (refreshError) {
          logger.error('[tiktok] Token refresh failed during retry', { error: refreshError });
          throw new PlatformError(
            'tiktok',
            'Token expired and refresh failed. Please re-authenticate.',
            401
          );
        }
      }

      if (!response.ok || data.error) {
        throw new PlatformError(
          'tiktok',
          data.error?.message || `API request failed: ${response.status}`,
          response.status
        );
      }

      return data;
    } catch (error: unknown) {
      if (error instanceof PlatformError) throw error;
      const originalError = error instanceof Error ? error : undefined;
      throw new PlatformError(
        'tiktok',
        error instanceof Error ? error.message : String(error),
        undefined,
        originalError
      );
    }
  }

  /**
   * Override canRefreshToken to indicate TikTok supports token refresh
   */
  protected override canRefreshToken(): boolean {
    return !!this.credentials?.refreshToken;
  }

  /**
   * Refresh access token using TikTok OAuth endpoint
   */
  async refreshToken(): Promise<PlatformCredentials> {
    if (!this.credentials?.refreshToken) {
      throw new PlatformError('tiktok', 'No refresh token available');
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

    if (!clientKey || !clientSecret) {
      throw new PlatformError('tiktok', 'TikTok app credentials not configured');
    }

    try {
      const response = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: this.credentials.refreshToken,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new PlatformError(
          'tiktok',
          data.error_description || data.error || 'Token refresh failed',
          response.status
        );
      }

      const newCredentials: PlatformCredentials = {
        ...this.credentials,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || this.credentials.refreshToken,
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000)
          : this.credentials.expiresAt,
      };

      this.credentials = newCredentials;
      return newCredentials;
    } catch (error: unknown) {
      if (error instanceof PlatformError) throw error;
      throw new PlatformError(
        'tiktok',
        `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      if (!this.isConfigured()) return false;

      // Try to fetch user info — if it works, credentials are valid
      await this.makeRequest<TikTokUserInfo>(
        '/user/info/?fields=open_id,display_name'
      );
      return true;
    } catch (error) {
      logger.error('TikTok credentials validation failed', { error });
      return false;
    }
  }

  /**
   * Sync analytics data from TikTok
   *
   * TikTok's creator analytics API is limited. We fetch basic user stats
   * (follower_count, following_count, likes_count, video_count) from the
   * user info endpoint. Detailed per-post analytics are not available via
   * the standard Content Posting API.
   */
  async syncAnalytics(days: number = 30): Promise<SyncAnalyticsResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          metrics: { impressions: 0, engagements: 0, followers: 0 },
          period: { start: new Date(), end: new Date() },
          error: 'Service not configured',
        };
      }

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      // Fetch user info with stats fields
      const userInfoResponse = await this.makeRequest<TikTokUserInfo>(
        '/user/info/?fields=open_id,display_name,follower_count,following_count,likes_count,video_count'
      );

      const user = userInfoResponse.data?.user;
      const followers = user?.follower_count || 0;
      const following = user?.following_count || 0;
      const totalLikes = user?.likes_count || 0;
      const videoCount = user?.video_count || 0;

      // Estimate engagements from total likes (TikTok doesn't provide
      // aggregated engagement metrics via this endpoint)
      let engagements = 0;
      let impressions = 0;

      // Try to get engagement data from recent videos
      try {
        const videosResponse = await this.makeRequest<TikTokVideoListResponse>(
          '/video/list/?fields=id,like_count,comment_count,share_count,view_count',
          {
            method: 'POST',
            body: JSON.stringify({ max_count: 20 }),
          }
        );

        for (const video of videosResponse.data?.videos || []) {
          engagements += (video.like_count || 0) +
            (video.comment_count || 0) +
            (video.share_count || 0);
          impressions += video.view_count || 0;
        }
      } catch (error) {
        logger.warn('TikTok video list fetch failed for analytics, using user-level data', { error });
        engagements = totalLikes; // Fallback to total likes
      }

      return {
        success: true,
        metrics: {
          impressions,
          engagements,
          followers,
          following,
          posts: videoCount,
          likes: totalLikes,
        },
        period: {
          start: startDate,
          end: endDate,
        },
      };
    } catch (error: unknown) {
      logger.error('TikTok analytics sync failed', { error });
      return {
        success: false,
        metrics: { impressions: 0, engagements: 0, followers: 0 },
        period: { start: new Date(), end: new Date() },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Sync posts (videos) from TikTok
   *
   * Uses POST /v2/video/list/ with max_count and optional cursor
   */
  async syncPosts(limit: number = 20, cursor?: string): Promise<SyncPostsResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          posts: [],
          total: 0,
          hasMore: false,
          error: 'Service not configured',
        };
      }

      const body: Record<string, unknown> = {
        max_count: Math.min(limit, 20), // TikTok max is 20 per request
      };

      if (cursor) {
        body.cursor = parseInt(cursor, 10);
      }

      const response = await this.makeRequest<TikTokVideoListResponse>(
        '/video/list/?fields=id,title,video_description,create_time,cover_image_url,share_url,duration,like_count,comment_count,share_count,view_count',
        {
          method: 'POST',
          body: JSON.stringify(body),
        }
      );

      const videos = response.data?.videos || [];

      const posts = videos.map((video) => ({
        id: video.id,
        platformId: video.id,
        content: video.video_description || video.title || '',
        mediaUrls: video.cover_image_url ? [video.cover_image_url] : [],
        publishedAt: new Date((video.create_time || 0) * 1000),
        metrics: {
          likes: video.like_count || 0,
          comments: video.comment_count || 0,
          shares: video.share_count || 0,
          impressions: video.view_count || 0,
        },
        url: video.share_url,
      }));

      const nextCursor = response.data?.cursor?.toString();
      const hasMore = response.data?.has_more || false;

      return {
        success: true,
        posts,
        total: posts.length,
        hasMore,
        cursor: hasMore ? nextCursor : undefined,
      };
    } catch (error: unknown) {
      logger.error('TikTok posts sync failed', { error });
      return {
        success: false,
        posts: [],
        total: 0,
        hasMore: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Sync profile information from TikTok
   */
  async syncProfile(): Promise<SyncProfileResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          profile: {
            id: '',
            username: '',
            displayName: '',
            followers: 0,
            following: 0,
            postsCount: 0,
          },
          error: 'Service not configured',
        };
      }

      const response = await this.makeRequest<TikTokUserInfo>(
        '/user/info/?fields=open_id,union_id,avatar_url,display_name,bio_description,follower_count,following_count,likes_count,video_count,is_verified,profile_deep_link'
      );

      const user = response.data?.user;

      if (!user) {
        throw new PlatformError('tiktok', 'No user data returned from TikTok API');
      }

      return {
        success: true,
        profile: {
          id: user.open_id,
          username: user.display_name || '',
          displayName: user.display_name || '',
          bio: user.bio_description || '',
          avatarUrl: user.avatar_url || '',
          followers: user.follower_count || 0,
          following: user.following_count || 0,
          postsCount: user.video_count || 0,
          verified: user.is_verified || false,
          url: user.profile_deep_link || '',
        },
      };
    } catch (error: unknown) {
      logger.error('TikTok profile sync failed', { error });
      return {
        success: false,
        profile: {
          id: '',
          username: '',
          displayName: '',
          followers: 0,
          following: 0,
          postsCount: 0,
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create a new TikTok video post
   *
   * Two-step process:
   * 1. POST to /v2/post/publish/video/init/ with post_info and source_info
   * 2. Return publish_id — TikTok processes videos asynchronously
   *
   * Note: TikTok requires a video URL (PULL_FROM_URL source) or file upload.
   * Text-only posts are not supported on TikTok.
   */
  async createPost(content: PostContent): Promise<PostResult> {
    try {
      if (!this.isConfigured()) {
        return { success: false, error: 'Service not configured' };
      }

      // TikTok requires video media
      if (!content.mediaUrls || content.mediaUrls.length === 0) {
        return {
          success: false,
          error: 'TikTok posts require a video URL. Text-only posts are not supported.',
        };
      }

      const videoUrl = content.mediaUrls[0];

      // Map visibility to TikTok privacy_level
      let privacyLevel = 'PUBLIC_TO_EVERYONE';
      if (content.visibility === 'private') {
        privacyLevel = 'SELF_ONLY';
      } else if (content.visibility === 'connections') {
        privacyLevel = 'MUTUAL_FOLLOW_FRIENDS';
      }

      const response = await this.makeRequest<TikTokPublishInitResponse>(
        '/post/publish/video/init/',
        {
          method: 'POST',
          body: JSON.stringify({
            post_info: {
              title: content.text || '',
              privacy_level: privacyLevel,
              disable_comment: false,
              disable_duet: false,
              disable_stitch: false,
            },
            source_info: {
              source: 'PULL_FROM_URL',
              video_url: videoUrl,
            },
          }),
        }
      );

      const publishId = response.data?.publish_id;

      if (!publishId) {
        return { success: false, error: 'Failed to initialize TikTok video upload' };
      }

      return {
        success: true,
        postId: publishId,
        // TikTok doesn't return a URL immediately — video is processed async
      };
    } catch (error: unknown) {
      logger.error('TikTok post creation failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete a TikTok post
   *
   * TikTok API does not support programmatic video deletion.
   * Users must delete videos through the TikTok app.
   */
  async deletePost(postId: string): Promise<boolean> {
    logger.warn('TikTok post deletion not supported via API. Users must delete videos through the TikTok app.', { postId });
    return false;
  }

  /**
   * Get metrics for a specific TikTok video
   *
   * Uses POST /v2/video/query/ with the video ID to fetch metrics
   */
  async getPostMetrics(postId: string): Promise<TikTokPostMetrics | null> {
    try {
      if (!this.isConfigured()) {
        return null;
      }

      const response = await this.makeRequest<TikTokVideoQueryResponse>(
        '/video/query/?fields=id,like_count,comment_count,share_count,view_count',
        {
          method: 'POST',
          body: JSON.stringify({
            filters: {
              video_ids: [postId],
            },
          }),
        }
      );

      const video = response.data?.videos?.[0];

      if (!video) {
        logger.warn('TikTok video not found for metrics', { postId });
        return null;
      }

      return {
        likes: video.like_count || 0,
        comments: video.comment_count || 0,
        shares: video.share_count || 0,
        views: video.view_count || 0,
      };
    } catch (error: unknown) {
      logger.error('TikTok post metrics fetch failed', { error, postId });
      return null;
    }
  }
}

// Export singleton instance
export const tiktokService = new TikTokService();
