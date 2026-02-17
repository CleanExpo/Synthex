/**
 * YouTube Platform Service
 *
 * @description YouTube Data API v3 integration via direct fetch()
 * Supports video upload, analytics sync, and channel management
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - GOOGLE_CLIENT_ID: Google OAuth client ID (SECRET)
 * - GOOGLE_CLIENT_SECRET: Google OAuth client secret (SECRET)
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
// YOUTUBE API RESPONSE TYPES
// ============================================================================

/** YouTube API error response */
interface YouTubeApiError {
  error?: {
    code: number;
    message: string;
    errors?: Array<{
      domain: string;
      reason: string;
      message: string;
    }>;
  };
}

/** YouTube channel resource */
interface YouTubeChannel {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    customUrl?: string;
    thumbnails?: {
      default?: { url?: string };
      high?: { url?: string };
    };
    country?: string;
  };
  statistics?: {
    viewCount?: string;
    subscriberCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
  brandingSettings?: {
    channel?: {
      title?: string;
      description?: string;
      keywords?: string;
    };
    image?: {
      bannerExternalUrl?: string;
    };
  };
}

/** YouTube channels list response */
interface YouTubeChannelsResponse extends YouTubeApiError {
  items?: YouTubeChannel[];
}

/** YouTube playlist item */
interface YouTubePlaylistItem {
  contentDetails: {
    videoId: string;
  };
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    thumbnails?: {
      high?: { url?: string };
    };
  };
}

/** YouTube playlist items response */
interface YouTubePlaylistItemsResponse extends YouTubeApiError {
  items?: YouTubePlaylistItem[];
  nextPageToken?: string;
  pageInfo?: {
    totalResults?: number;
  };
}

/** YouTube video resource */
interface YouTubeVideo {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    thumbnails?: {
      high?: { url?: string };
    };
    tags?: string[];
    categoryId?: string;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
    favoriteCount?: string;
    shareCount?: string;
  };
  status?: {
    uploadStatus?: string;
    privacyStatus?: string;
  };
}

/** YouTube videos list response */
interface YouTubeVideosResponse extends YouTubeApiError {
  items?: YouTubeVideo[];
}

/** YouTube Analytics report response */
interface YouTubeAnalyticsResponse extends YouTubeApiError {
  columnHeaders?: Array<{
    name: string;
    columnType: string;
    dataType: string;
  }>;
  rows?: Array<Array<string | number>>;
}

/** YouTube upload init response */
interface YouTubeUploadInitResponse extends YouTubeApiError {
  id?: string;
  status?: {
    uploadStatus?: string;
  };
}

/** YouTube post metrics */
interface YouTubePostMetrics {
  views: number;
  likes: number;
  comments: number;
  favorites: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3';
const YOUTUBE_ANALYTICS_BASE = 'https://youtubeanalytics.googleapis.com/v2';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// ============================================================================
// SERVICE
// ============================================================================

export class YouTubeService extends BasePlatformService {
  readonly platform = 'youtube';
  private channelId: string | null = null;
  private uploadsPlaylistId: string | null = null;

  /**
   * Make an authenticated request to the YouTube API
   */
  private async makeRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Ensure token is valid before making request (auto-refresh if needed)
    await this.ensureValidToken();

    if (!this.credentials?.accessToken) {
      throw new PlatformError('youtube', 'No access token configured');
    }

    const fullUrl = url.startsWith('http') ? url : `${YOUTUBE_API_BASE}${url}`;

    try {
      const response = await fetch(fullUrl, {
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
        this.updateRateLimits(fullUrl, rateLimitHeaders);
      }

      // Handle 204 No Content (e.g., delete)
      if (response.status === 204) {
        return {} as T;
      }

      const data: T & YouTubeApiError = await response.json();

      // Handle token expired errors — attempt refresh and retry
      if (response.status === 401 || data.error?.code === 401) {
        logger.warn('[youtube] Token expired during request, attempting refresh...', {
          errorCode: data.error?.code,
        });

        try {
          await this.refreshToken();

          // Retry the request with new token
          const retryResponse = await fetch(fullUrl, {
            ...options,
            headers: {
              Authorization: `Bearer ${this.credentials.accessToken}`,
              'Content-Type': 'application/json',
              ...(options.headers || {}),
            },
          });

          const retryData: T & YouTubeApiError = await retryResponse.json();

          if (!retryResponse.ok || retryData.error) {
            throw new PlatformError(
              'youtube',
              retryData.error?.message || `API request failed after token refresh: ${retryResponse.status}`,
              retryResponse.status
            );
          }

          return retryData;
        } catch (refreshError) {
          logger.error('[youtube] Token refresh failed during retry', { error: refreshError });
          throw new PlatformError(
            'youtube',
            'Token expired and refresh failed. Please re-authenticate.',
            401
          );
        }
      }

      if (!response.ok || data.error) {
        throw new PlatformError(
          'youtube',
          data.error?.message || `API request failed: ${response.status}`,
          response.status
        );
      }

      return data;
    } catch (error: unknown) {
      if (error instanceof PlatformError) throw error;
      const originalError = error instanceof Error ? error : undefined;
      throw new PlatformError(
        'youtube',
        error instanceof Error ? error.message : String(error),
        undefined,
        originalError
      );
    }
  }

  /**
   * Override canRefreshToken to indicate YouTube supports token refresh
   */
  protected override canRefreshToken(): boolean {
    return !!this.credentials?.refreshToken;
  }

  /**
   * Refresh access token using Google OAuth endpoint
   */
  async refreshToken(): Promise<PlatformCredentials> {
    if (!this.credentials?.refreshToken) {
      throw new PlatformError('youtube', 'No refresh token available');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new PlatformError('youtube', 'Google OAuth credentials not configured');
    }

    try {
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.credentials.refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new PlatformError(
          'youtube',
          data.error_description || data.error || 'Token refresh failed',
          response.status
        );
      }

      // Google doesn't return a new refresh token on refresh
      const newCredentials: PlatformCredentials = {
        ...this.credentials,
        accessToken: data.access_token,
        refreshToken: this.credentials.refreshToken, // Keep original
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000)
          : this.credentials.expiresAt,
      };

      this.credentials = newCredentials;
      return newCredentials;
    } catch (error: unknown) {
      if (error instanceof PlatformError) throw error;
      throw new PlatformError(
        'youtube',
        `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get the authenticated user's channel info and cache IDs
   */
  private async getChannelInfo(): Promise<YouTubeChannel> {
    const response = await this.makeRequest<YouTubeChannelsResponse>(
      '/channels?part=snippet,statistics,contentDetails,brandingSettings&mine=true'
    );

    const channel = response.items?.[0];

    if (!channel) {
      throw new PlatformError('youtube', 'No YouTube channel found for this account');
    }

    this.channelId = channel.id;
    this.uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads || null;

    return channel;
  }

  async validateCredentials(): Promise<boolean> {
    try {
      if (!this.isConfigured()) return false;

      // Try to fetch channel info — if it works, credentials are valid
      await this.getChannelInfo();
      return true;
    } catch (error) {
      logger.error('YouTube credentials validation failed', { error });
      return false;
    }
  }

  /**
   * Sync analytics data from YouTube
   *
   * Fetches channel-level statistics and optionally daily breakdown
   * from YouTube Analytics API.
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

      // Get channel statistics
      const channel = await this.getChannelInfo();
      const stats = channel.statistics || {};

      const subscribers = parseInt(stats.subscriberCount || '0', 10);
      const totalViews = parseInt(stats.viewCount || '0', 10);
      const videoCount = parseInt(stats.videoCount || '0', 10);

      // Try to get daily breakdown from YouTube Analytics API
      const dailyBreakdown: Array<{ date: string; impressions: number; engagements: number }> = [];
      let periodViews = 0;
      let periodEngagements = 0;

      try {
        const startStr = formatDate(startDate);
        const endStr = formatDate(endDate);

        const analyticsUrl =
          `${YOUTUBE_ANALYTICS_BASE}/reports` +
          `?ids=channel==MINE` +
          `&startDate=${startStr}` +
          `&endDate=${endStr}` +
          `&metrics=views,likes,comments,shares,subscribersGained` +
          `&dimensions=day` +
          `&sort=day`;

        const analyticsResponse = await this.makeRequest<YouTubeAnalyticsResponse>(analyticsUrl);

        if (analyticsResponse.rows) {
          for (const row of analyticsResponse.rows) {
            const date = String(row[0]);
            const views = Number(row[1]) || 0;
            const likes = Number(row[2]) || 0;
            const comments = Number(row[3]) || 0;
            const shares = Number(row[4]) || 0;

            periodViews += views;
            periodEngagements += likes + comments + shares;

            dailyBreakdown.push({
              date,
              impressions: views,
              engagements: likes + comments + shares,
            });
          }
        }
      } catch (error) {
        logger.warn('YouTube Analytics API fetch failed, using channel-level data', { error });

        // Fallback: estimate from recent videos
        try {
          await this.ensureUploadsPlaylistId();

          if (this.uploadsPlaylistId) {
            const videosResponse = await this.makeRequest<YouTubePlaylistItemsResponse>(
              `/playlistItems?part=contentDetails&playlistId=${this.uploadsPlaylistId}&maxResults=20`
            );

            const videoIds = videosResponse.items
              ?.map((item) => item.contentDetails.videoId)
              .join(',');

            if (videoIds) {
              const statsResponse = await this.makeRequest<YouTubeVideosResponse>(
                `/videos?part=statistics&id=${videoIds}`
              );

              for (const video of statsResponse.items || []) {
                const vs = video.statistics || {};
                periodViews += parseInt(vs.viewCount || '0', 10);
                periodEngagements +=
                  parseInt(vs.likeCount || '0', 10) +
                  parseInt(vs.commentCount || '0', 10);
              }
            }
          }
        } catch (fallbackError) {
          logger.warn('YouTube video stats fallback also failed', { error: fallbackError });
        }
      }

      return {
        success: true,
        metrics: {
          impressions: periodViews || totalViews,
          engagements: periodEngagements,
          followers: subscribers,
          posts: videoCount,
        },
        period: {
          start: startDate,
          end: endDate,
        },
        breakdown: dailyBreakdown.length > 0 ? { daily: dailyBreakdown } : undefined,
      };
    } catch (error: unknown) {
      logger.error('YouTube analytics sync failed', { error });
      return {
        success: false,
        metrics: { impressions: 0, engagements: 0, followers: 0 },
        period: { start: new Date(), end: new Date() },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Ensure we have the uploads playlist ID cached
   */
  private async ensureUploadsPlaylistId(): Promise<void> {
    if (!this.uploadsPlaylistId) {
      await this.getChannelInfo();
    }
  }

  /**
   * Sync posts (videos) from YouTube
   *
   * Gets videos from the channel's uploads playlist, then fetches
   * statistics for each video.
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

      await this.ensureUploadsPlaylistId();

      if (!this.uploadsPlaylistId) {
        return {
          success: false,
          posts: [],
          total: 0,
          hasMore: false,
          error: 'No uploads playlist found for channel',
        };
      }

      // Get videos from uploads playlist
      let endpoint =
        `/playlistItems?part=snippet,contentDetails` +
        `&playlistId=${this.uploadsPlaylistId}` +
        `&maxResults=${Math.min(limit, 50)}`;

      if (cursor) {
        endpoint += `&pageToken=${cursor}`;
      }

      const playlistResponse = await this.makeRequest<YouTubePlaylistItemsResponse>(endpoint);

      const items = playlistResponse.items || [];

      if (items.length === 0) {
        return {
          success: true,
          posts: [],
          total: 0,
          hasMore: false,
        };
      }

      // Batch fetch video statistics
      const videoIds = items.map((item) => item.contentDetails.videoId).join(',');
      const statsResponse = await this.makeRequest<YouTubeVideosResponse>(
        `/videos?part=statistics,snippet&id=${videoIds}`
      );

      const statsMap = new Map(
        (statsResponse.items || []).map((item) => [item.id, item])
      );

      const posts = items.map((item) => {
        const videoId = item.contentDetails.videoId;
        const videoData = statsMap.get(videoId);
        const vs = videoData?.statistics || {};

        return {
          id: videoId,
          platformId: videoId,
          content: item.snippet.title || '',
          mediaUrls: item.snippet.thumbnails?.high?.url
            ? [item.snippet.thumbnails.high.url]
            : [],
          publishedAt: new Date(item.snippet.publishedAt),
          metrics: {
            likes: parseInt(vs.likeCount || '0', 10),
            comments: parseInt(vs.commentCount || '0', 10),
            shares: 0, // YouTube doesn't expose shares in Data API v3
            impressions: parseInt(vs.viewCount || '0', 10),
          },
          url: `https://www.youtube.com/watch?v=${videoId}`,
        };
      });

      const nextCursor = playlistResponse.nextPageToken;

      return {
        success: true,
        posts,
        total: playlistResponse.pageInfo?.totalResults || posts.length,
        hasMore: !!nextCursor,
        cursor: nextCursor,
      };
    } catch (error: unknown) {
      logger.error('YouTube posts sync failed', { error });
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
   * Sync profile (channel) information from YouTube
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

      const channel = await this.getChannelInfo();

      return {
        success: true,
        profile: {
          id: channel.id,
          username: channel.snippet?.customUrl || channel.snippet?.title || '',
          displayName: channel.snippet?.title || '',
          bio: channel.snippet?.description || '',
          avatarUrl: channel.snippet?.thumbnails?.high?.url || channel.snippet?.thumbnails?.default?.url || '',
          coverUrl: channel.brandingSettings?.image?.bannerExternalUrl || '',
          followers: parseInt(channel.statistics?.subscriberCount || '0', 10),
          following: 0, // YouTube doesn't expose subscriptions count via this endpoint
          postsCount: parseInt(channel.statistics?.videoCount || '0', 10),
          verified: false, // Not available via Data API v3
          url: `https://www.youtube.com/channel/${channel.id}`,
        },
      };
    } catch (error: unknown) {
      logger.error('YouTube profile sync failed', { error });
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
   * Create a new YouTube video post
   *
   * Uses resumable upload:
   * 1. POST to initiate resumable upload session with video metadata
   * 2. Fetch video from provided URL
   * 3. PUT video content to the resumable upload URI
   *
   * Note: Requires a video URL in content.mediaUrls[0].
   * Text-only posts are not supported on YouTube.
   */
  async createPost(content: PostContent): Promise<PostResult> {
    try {
      if (!this.isConfigured()) {
        return { success: false, error: 'Service not configured' };
      }

      // YouTube requires video media
      if (!content.mediaUrls || content.mediaUrls.length === 0) {
        return {
          success: false,
          error: 'YouTube posts require a video URL. Text-only posts are not supported.',
        };
      }

      const videoUrl = content.mediaUrls[0];

      // Ensure token is valid
      await this.ensureValidToken();

      // Map visibility to YouTube privacy status
      let privacyStatus = 'public';
      if (content.visibility === 'private') {
        privacyStatus = 'private';
      } else if (content.visibility === 'connections') {
        privacyStatus = 'unlisted';
      }

      const videoMetadata = {
        snippet: {
          title: content.text || 'Untitled Video',
          description: content.text || '',
          categoryId: '22', // People & Blogs
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: false,
        },
      };

      // Step 1: Initiate resumable upload session
      const uploadInitUrl = `${YOUTUBE_UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`;

      const initResponse = await fetch(uploadInitUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.credentials!.accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/*',
        },
        body: JSON.stringify(videoMetadata),
      });

      if (!initResponse.ok) {
        const errorData = await initResponse.json();
        throw new PlatformError(
          'youtube',
          errorData.error?.message || 'Failed to initialize video upload',
          initResponse.status
        );
      }

      const resumableUri = initResponse.headers.get('location');

      if (!resumableUri) {
        throw new PlatformError('youtube', 'Failed to get upload URI from YouTube');
      }

      // Step 2: Fetch video content from URL
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        return {
          success: false,
          error: 'Failed to fetch video from provided URL',
        };
      }

      const videoBuffer = await videoResponse.arrayBuffer();

      // Step 3: Upload video content
      const uploadResponse = await fetch(resumableUri, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.credentials!.accessToken}`,
          'Content-Type': 'video/*',
          'Content-Length': videoBuffer.byteLength.toString(),
        },
        body: videoBuffer,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new PlatformError(
          'youtube',
          errorData.error?.message || 'Failed to upload video',
          uploadResponse.status
        );
      }

      const uploadResult: YouTubeUploadInitResponse = await uploadResponse.json();
      const videoId = uploadResult.id;

      if (!videoId) {
        return { success: false, error: 'Upload completed but no video ID returned' };
      }

      return {
        success: true,
        postId: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    } catch (error: unknown) {
      logger.error('YouTube post creation failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete a YouTube video
   *
   * DELETE /youtube/v3/videos?id={videoId}
   */
  async deletePost(postId: string): Promise<boolean> {
    try {
      if (!this.isConfigured()) {
        return false;
      }

      await this.makeRequest<Record<string, unknown>>(
        `/videos?id=${postId}`,
        { method: 'DELETE' }
      );

      return true;
    } catch (error: unknown) {
      logger.error('YouTube video deletion failed', { error, postId });
      return false;
    }
  }

  /**
   * Get metrics for a specific YouTube video
   *
   * GET /youtube/v3/videos?part=statistics&id={videoId}
   */
  async getPostMetrics(postId: string): Promise<YouTubePostMetrics | null> {
    try {
      if (!this.isConfigured()) {
        return null;
      }

      const response = await this.makeRequest<YouTubeVideosResponse>(
        `/videos?part=statistics&id=${postId}`
      );

      const video = response.items?.[0];

      if (!video) {
        logger.warn('YouTube video not found for metrics', { postId });
        return null;
      }

      const stats = video.statistics || {};

      return {
        views: parseInt(stats.viewCount || '0', 10),
        likes: parseInt(stats.likeCount || '0', 10),
        comments: parseInt(stats.commentCount || '0', 10),
        favorites: parseInt(stats.favoriteCount || '0', 10),
      };
    } catch (error: unknown) {
      logger.error('YouTube post metrics fetch failed', { error, postId });
      return null;
    }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format a Date as YYYY-MM-DD for YouTube Analytics API
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Export singleton instance
export const youtubeService = new YouTubeService();
