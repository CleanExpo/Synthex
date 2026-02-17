/**
 * Threads Platform Service
 *
 * @description Threads API integration via Meta Graph API
 * Supports Threads accounts connected via Meta OAuth
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - THREADS_APP_ID: Threads/Meta App ID (SECRET)
 * - THREADS_APP_SECRET: Threads/Meta App Secret (SECRET)
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
// THREADS API RESPONSE TYPES
// ============================================================================

/** Threads profile response */
interface ThreadsProfileResponse {
  id: string;
  username?: string;
  name?: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
}

/** Threads insights response */
interface ThreadsInsightsResponse {
  data?: ThreadsInsightElement[];
}

/** Threads insight element */
interface ThreadsInsightElement {
  name: string;
  title?: string;
  description?: string;
  period?: string;
  values?: Array<{
    value?: number;
    end_time?: string;
  }>;
  total_value?: {
    value?: number;
  };
  id?: string;
}

/** Threads list response */
interface ThreadsListResponse {
  data?: ThreadsPostElement[];
  paging?: {
    cursors?: {
      after?: string;
      before?: string;
    };
  };
}

/** Threads post element */
interface ThreadsPostElement {
  id: string;
  text?: string;
  timestamp?: string;
  media_url?: string;
  media_type?: string;
  shortcode?: string;
  permalink?: string;
  is_reply?: boolean;
  reply_audience?: string;
}

/** Thread container creation response */
interface ThreadContainerResponse {
  id?: string;
}

/** Thread publish response */
interface ThreadPublishResponse {
  id?: string;
}

/** Thread post insights response */
interface ThreadPostInsightsResponse {
  data?: ThreadsInsightElement[];
}

/** Threads post metrics */
interface ThreadsPostMetrics {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
}

/** Threads user info for follower count */
interface ThreadsUserInfoResponse {
  id: string;
  username?: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
  followers_count?: number;
}

const THREADS_API_BASE = 'https://graph.threads.net/v1.0';

export class ThreadsService extends BasePlatformService {
  readonly platform = 'threads';

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Ensure token is valid before making request (auto-refresh if needed)
    await this.ensureValidToken();

    if (!this.credentials?.accessToken) {
      throw new PlatformError('threads', 'No access token configured');
    }

    // Use Bearer header for authentication (no token in URL)
    const url = `${THREADS_API_BASE}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.credentials.accessToken}`,
          ...(options.headers || {}),
        },
      });

      const data = await response.json();

      // Check for token expiry error and attempt refresh
      if (data.error?.code === 190 || data.error?.error_subcode === 463) {
        logger.warn('[threads] Token expired during request, attempting refresh...', {
          errorCode: data.error?.code,
          errorSubcode: data.error?.error_subcode,
        });

        try {
          await this.refreshToken();
          // Retry the request with new token
          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.credentials.accessToken}`,
              ...(options.headers || {}),
            },
          });
          const retryData = await retryResponse.json();

          if (!retryResponse.ok || retryData.error) {
            throw new PlatformError(
              'threads',
              retryData.error?.message || `API request failed after token refresh: ${retryResponse.status}`,
              retryResponse.status
            );
          }
          return retryData;
        } catch (refreshError) {
          logger.error('[threads] Token refresh failed during retry', { error: refreshError });
          throw new PlatformError(
            'threads',
            'Token expired and refresh failed. Please re-authenticate.',
            401
          );
        }
      }

      if (!response.ok || data.error) {
        throw new PlatformError(
          'threads',
          data.error?.message || `API request failed: ${response.status}`,
          response.status
        );
      }

      return data;
    } catch (error: unknown) {
      if (error instanceof PlatformError) throw error;
      const originalError = error instanceof Error ? error : undefined;
      throw new PlatformError('threads', error instanceof Error ? error.message : String(error), undefined, originalError);
    }
  }

  /**
   * Override canRefreshToken to indicate Threads supports token refresh
   * Threads uses long-lived tokens (60 days) that can be refreshed
   */
  protected override canRefreshToken(): boolean {
    return !!this.credentials?.accessToken;
  }

  async validateCredentials(): Promise<boolean> {
    try {
      if (!this.isConfigured()) return false;

      await this.makeRequest<ThreadsProfileResponse>(
        '/me?fields=id,username'
      );
      return true;
    } catch (error) {
      logger.error('Threads credentials validation failed', { error });
      return false;
    }
  }

  async refreshToken(): Promise<PlatformCredentials> {
    if (!this.credentials?.accessToken) {
      throw new PlatformError('threads', 'No access token to refresh');
    }

    try {
      // Threads uses th_refresh_token grant type to refresh long-lived tokens
      const response = await fetch(
        `https://graph.threads.net/refresh_access_token?` +
        `grant_type=th_refresh_token&` +
        `access_token=${this.credentials.accessToken}`
      );

      const data = await response.json();

      if (data.error) {
        throw new PlatformError('threads', data.error.message || 'Threads API error');
      }

      const newCredentials: PlatformCredentials = {
        ...this.credentials,
        accessToken: data.access_token,
        expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000), // Default 60 days
      };

      this.credentials = newCredentials;
      return newCredentials;
    } catch (error: unknown) {
      throw new PlatformError('threads', `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

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
      const since = Math.floor(startDate.getTime() / 1000);
      const until = Math.floor(endDate.getTime() / 1000);

      let views = 0;
      let likes = 0;
      let replies = 0;
      let reposts = 0;
      let quotes = 0;
      let followers = 0;

      // Get user insights
      try {
        const insightsResponse = await this.makeRequest<ThreadsInsightsResponse>(
          `/me/threads_insights?metric=views,likes,replies,reposts,quotes&period=day&since=${since}&until=${until}`
        );

        for (const insight of insightsResponse.data || []) {
          // Sum up all daily values
          const totalValue = insight.total_value?.value ||
            (insight.values || []).reduce((sum, v) => sum + (v.value || 0), 0);

          switch (insight.name) {
            case 'views':
              views = totalValue;
              break;
            case 'likes':
              likes = totalValue;
              break;
            case 'replies':
              replies = totalValue;
              break;
            case 'reposts':
              reposts = totalValue;
              break;
            case 'quotes':
              quotes = totalValue;
              break;
          }
        }
      } catch (error) {
        logger.warn('Threads insights fetch failed', { error });
      }

      // Get follower count from profile endpoint
      try {
        const profile = await this.makeRequest<ThreadsUserInfoResponse>(
          '/me?fields=id,followers_count'
        );
        followers = profile.followers_count || 0;
      } catch (error) {
        logger.warn('Threads follower count fetch failed', { error });
      }

      // Build daily breakdown from insights
      const dailyBreakdown: Array<{ date: string; impressions: number; engagements: number }> = [];

      try {
        const dailyInsights = await this.makeRequest<ThreadsInsightsResponse>(
          `/me/threads_insights?metric=views,likes&period=day&since=${since}&until=${until}`
        );

        const viewsData = dailyInsights.data?.find((d: ThreadsInsightElement) => d.name === 'views');
        const likesData = dailyInsights.data?.find((d: ThreadsInsightElement) => d.name === 'likes');

        if (viewsData?.values) {
          for (let i = 0; i < viewsData.values.length; i++) {
            const value = viewsData.values[i];
            const likeValue = likesData?.values?.[i]?.value || 0;
            dailyBreakdown.push({
              date: value.end_time?.split('T')[0] || '',
              impressions: value.value || 0,
              engagements: likeValue,
            });
          }
        }
      } catch {
        // Daily breakdown not available
      }

      const engagements = likes + replies + reposts + quotes;

      return {
        success: true,
        metrics: {
          impressions: views,
          engagements,
          followers,
          likes,
          comments: replies,
          shares: reposts,
        },
        period: {
          start: startDate,
          end: endDate,
        },
        breakdown: {
          daily: dailyBreakdown,
        },
      };
    } catch (error: unknown) {
      logger.error('Threads analytics sync failed', { error });
      return {
        success: false,
        metrics: { impressions: 0, engagements: 0, followers: 0 },
        period: { start: new Date(), end: new Date() },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

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

      // Build query
      const fields = [
        'id',
        'text',
        'timestamp',
        'media_url',
        'media_type',
        'shortcode',
        'permalink',
        'is_reply',
        'reply_audience',
      ].join(',');

      let endpoint = `/me/threads?fields=${fields}&limit=${limit}`;
      if (cursor) {
        endpoint += `&after=${cursor}`;
      }

      const response = await this.makeRequest<ThreadsListResponse>(endpoint);

      const posts = (response.data || []).map((thread: ThreadsPostElement) => {
        return {
          id: thread.id,
          platformId: thread.id,
          content: thread.text || '',
          mediaUrls: thread.media_url ? [thread.media_url] : [],
          publishedAt: new Date(thread.timestamp || Date.now()),
          metrics: {
            likes: 0, // Per-post metrics need separate insights call
            comments: 0,
            shares: 0,
          },
          url: thread.permalink,
        };
      });

      const nextCursor = response.paging?.cursors?.after;

      return {
        success: true,
        posts,
        total: posts.length,
        hasMore: !!nextCursor,
        cursor: nextCursor,
      };
    } catch (error: unknown) {
      logger.error('Threads posts sync failed', { error });
      return {
        success: false,
        posts: [],
        total: 0,
        hasMore: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

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

      const profile = await this.makeRequest<ThreadsProfileResponse>(
        '/me?fields=id,username,name,threads_profile_picture_url,threads_biography'
      );

      // Get follower count separately
      let followers = 0;
      try {
        const userInfo = await this.makeRequest<ThreadsUserInfoResponse>(
          '/me?fields=followers_count'
        );
        followers = userInfo.followers_count || 0;
      } catch {
        // Follower count not available
      }

      return {
        success: true,
        profile: {
          id: profile.id,
          username: profile.username || '',
          displayName: profile.name || profile.username || '',
          bio: profile.threads_biography || '',
          avatarUrl: profile.threads_profile_picture_url || '',
          followers,
          following: 0, // Threads API doesn't expose following count
          postsCount: 0, // Threads API doesn't expose post count directly
          verified: false, // Not available via API
          url: `https://www.threads.net/@${profile.username}`,
        },
      };
    } catch (error: unknown) {
      logger.error('Threads profile sync failed', { error });
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

  async createPost(content: PostContent): Promise<PostResult> {
    try {
      if (!this.isConfigured()) {
        return { success: false, error: 'Service not configured' };
      }

      // Determine media type
      let mediaType: 'TEXT' | 'IMAGE' | 'VIDEO' = 'TEXT';
      if (content.mediaUrls && content.mediaUrls.length > 0) {
        const mediaUrl = content.mediaUrls[0];
        const isVideo = mediaUrl.match(/\.(mp4|mov|avi|webm)$/i);
        mediaType = isVideo ? 'VIDEO' : 'IMAGE';
      }

      // Step 1: Create thread container
      const containerBody: Record<string, string> = {
        media_type: mediaType,
        text: content.text,
      };

      if (mediaType === 'IMAGE' && content.mediaUrls?.[0]) {
        containerBody.image_url = content.mediaUrls[0];
      } else if (mediaType === 'VIDEO' && content.mediaUrls?.[0]) {
        containerBody.video_url = content.mediaUrls[0];
      }

      // Add reply_control from metadata if present
      if (content.metadata?.replyControl) {
        containerBody.reply_control = content.metadata.replyControl as string;
      }

      const containerResponse = await this.makeRequest<ThreadContainerResponse>(
        '/me/threads',
        {
          method: 'POST',
          body: JSON.stringify(containerBody),
        }
      );

      if (!containerResponse.id) {
        return { success: false, error: 'Failed to create thread container' };
      }

      // For videos, wait for processing to complete
      if (mediaType === 'VIDEO') {
        let ready = false;
        let attempts = 0;
        while (!ready && attempts < 30) {
          await this.sleep(2000);
          try {
            const status = await this.makeRequest<{ status: string }>(
              `/${containerResponse.id}?fields=status`
            );
            if (status.status === 'FINISHED') {
              ready = true;
            } else if (status.status === 'ERROR') {
              return { success: false, error: 'Video processing failed' };
            }
          } catch {
            // Status check failed, try again
          }
          attempts++;
        }

        if (!ready) {
          return { success: false, error: 'Video processing timed out' };
        }
      }

      // Step 2: Publish the thread
      const publishResponse = await this.makeRequest<ThreadPublishResponse>(
        '/me/threads_publish',
        {
          method: 'POST',
          body: JSON.stringify({
            creation_id: containerResponse.id,
          }),
        }
      );

      if (!publishResponse.id) {
        return { success: false, error: 'Failed to publish thread' };
      }

      return {
        success: true,
        postId: publishResponse.id,
        url: `https://www.threads.net/t/${publishResponse.id}`,
      };
    } catch (error: unknown) {
      logger.error('Threads post creation failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deletePost(postId: string): Promise<boolean> {
    try {
      if (!this.isConfigured()) {
        return false;
      }

      await this.makeRequest<Record<string, unknown>>(
        `/${postId}`,
        { method: 'DELETE' }
      );

      return true;
    } catch (error: unknown) {
      // Threads may not support deletion via API
      logger.warn('Threads post deletion failed — may not be supported via API', { error, postId });
      return false;
    }
  }

  async getPostMetrics(postId: string): Promise<ThreadsPostMetrics | null> {
    try {
      if (!this.isConfigured()) {
        return null;
      }

      const response = await this.makeRequest<ThreadPostInsightsResponse>(
        `/${postId}/insights?metric=views,likes,replies,reposts,quotes`
      );

      let views = 0;
      let likes = 0;
      let replies = 0;
      let reposts = 0;
      let quotes = 0;

      for (const insight of response.data || []) {
        const value = insight.total_value?.value || insight.values?.[0]?.value || 0;
        switch (insight.name) {
          case 'views':
            views = value;
            break;
          case 'likes':
            likes = value;
            break;
          case 'replies':
            replies = value;
            break;
          case 'reposts':
            reposts = value;
            break;
          case 'quotes':
            quotes = value;
            break;
        }
      }

      return {
        views,
        likes,
        replies,
        reposts,
        quotes,
      };
    } catch (error: unknown) {
      logger.error('Threads post metrics fetch failed', { error, postId });
      return null;
    }
  }
}

// Export singleton instance
export const threadsService = new ThreadsService();
