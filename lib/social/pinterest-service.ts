/**
 * Pinterest Platform Service
 *
 * @description Pinterest API v5 integration for pin management and analytics
 * Supports creating/deleting pins, syncing posts, profile, and analytics
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - PINTEREST_APP_ID: Pinterest app ID (SECRET)
 * - PINTEREST_APP_SECRET: Pinterest app secret (SECRET)
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
// PINTEREST API v5 RESPONSE TYPES
// ============================================================================

/** Pinterest API error response */
interface PinterestApiError {
  code?: number;
  message?: string;
}

/** Pinterest user account response */
interface PinterestUserAccount {
  id: string;
  username?: string;
  business_name?: string;
  profile_image?: string;
  account_type?: string;
  follower_count?: number;
  following_count?: number;
  pin_count?: number;
  board_count?: number;
  monthly_views?: number;
  website_url?: string;
}

/** Pinterest analytics response */
interface PinterestAnalyticsResponse {
  all?: {
    daily_metrics?: Array<{
      date: string;
      data_status: string;
      metrics: Record<string, number>;
    }>;
    summary_metrics?: Record<string, number>;
  };
}

/** Pinterest pin item */
interface PinterestPin {
  id: string;
  title?: string;
  description?: string;
  link?: string;
  alt_text?: string;
  board_id?: string;
  created_at?: string;
  media?: {
    media_type?: string;
    images?: Record<string, { url: string; width: number; height: number }>;
  };
  pin_metrics?: {
    pin_click?: number;
    impression?: number;
    outbound_click?: number;
    save?: number;
  };
}

/** Pinterest pins list response */
interface PinterestPinsResponse {
  items?: PinterestPin[];
  bookmark?: string;
}

/** Pinterest pin creation response */
interface PinterestPinCreateResponse {
  id?: string;
  link?: string;
  title?: string;
  description?: string;
  board_id?: string;
}

/** Pinterest pin analytics response */
interface PinterestPinAnalyticsResponse {
  all?: {
    daily_metrics?: Array<{
      date: string;
      data_status: string;
      metrics: Record<string, number>;
    }>;
    summary_metrics?: Record<string, number>;
  };
}

/** Pinterest board item */
interface PinterestBoard {
  id: string;
  name: string;
  privacy?: string;
  description?: string;
  pin_count?: number;
}

/** Pinterest boards list response */
interface PinterestBoardsResponse {
  items?: PinterestBoard[];
  bookmark?: string;
}

/** Pinterest post metrics */
interface PinterestPostMetrics {
  impressions: number;
  saves: number;
  pinClicks: number;
  outboundClicks: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PINTEREST_API_BASE = 'https://api.pinterest.com/v5';

// ============================================================================
// SERVICE
// ============================================================================

export class PinterestService extends BasePlatformService {
  readonly platform = 'pinterest';

  /**
   * Make an authenticated request to the Pinterest API v5
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Ensure token is valid before making request (auto-refresh if needed)
    await this.ensureValidToken();

    if (!this.credentials?.accessToken) {
      throw new PlatformError('pinterest', 'No access token configured');
    }

    const url = `${PINTEREST_API_BASE}${endpoint}`;

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

      // Handle 204 No Content (e.g., delete)
      if (response.status === 204) {
        return {} as T;
      }

      const data = await response.json();

      // Handle token expired — attempt refresh and retry
      if (response.status === 401) {
        logger.warn('[pinterest] Token expired during request, attempting refresh...', {
          status: response.status,
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

          if (retryResponse.status === 204) {
            return {} as T;
          }

          const retryData = await retryResponse.json();

          if (!retryResponse.ok) {
            throw new PlatformError(
              'pinterest',
              retryData.message || `API request failed after token refresh: ${retryResponse.status}`,
              retryResponse.status
            );
          }

          return retryData;
        } catch (refreshError) {
          if (refreshError instanceof PlatformError) throw refreshError;
          logger.error('[pinterest] Token refresh failed during retry', { error: refreshError });
          throw new PlatformError(
            'pinterest',
            'Token expired and refresh failed. Please re-authenticate.',
            401
          );
        }
      }

      if (!response.ok) {
        const errorData = data as PinterestApiError;
        throw new PlatformError(
          'pinterest',
          errorData.message || `API request failed: ${response.status}`,
          response.status
        );
      }

      return data;
    } catch (error: unknown) {
      if (error instanceof PlatformError) throw error;
      const originalError = error instanceof Error ? error : undefined;
      throw new PlatformError(
        'pinterest',
        error instanceof Error ? error.message : String(error),
        undefined,
        originalError
      );
    }
  }

  /**
   * Override canRefreshToken to indicate Pinterest supports token refresh
   */
  protected override canRefreshToken(): boolean {
    return !!this.credentials?.refreshToken;
  }

  /**
   * Refresh access token using Pinterest OAuth endpoint
   * Pinterest requires Basic auth (client_id:client_secret)
   */
  async refreshToken(): Promise<PlatformCredentials> {
    if (!this.credentials?.refreshToken) {
      throw new PlatformError('pinterest', 'No refresh token available');
    }

    const clientId = process.env.PINTEREST_APP_ID;
    const clientSecret = process.env.PINTEREST_APP_SECRET;

    if (!clientId || !clientSecret) {
      throw new PlatformError('pinterest', 'Pinterest app credentials not configured');
    }

    try {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      const response = await fetch(`${PINTEREST_API_BASE}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.credentials.refreshToken,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new PlatformError(
          'pinterest',
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
        'pinterest',
        `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      if (!this.isConfigured()) return false;

      // Try to fetch user account — if it works, credentials are valid
      await this.makeRequest<PinterestUserAccount>('/user_account');
      return true;
    } catch (error) {
      logger.error('Pinterest credentials validation failed', { error });
      return false;
    }
  }

  /**
   * Sync analytics data from Pinterest
   *
   * GET /v5/user_account/analytics with metric_types=IMPRESSION,PIN_CLICK,OUTBOUND_CLICK,SAVE
   * Requires business account. Personal accounts may return 403 — handled gracefully.
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

      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      let impressions = 0;
      let pinClicks = 0;
      let outboundClicks = 0;
      let saves = 0;
      const dailyBreakdown: Array<{ date: string; impressions: number; engagements: number }> = [];

      try {
        const analyticsResponse = await this.makeRequest<PinterestAnalyticsResponse>(
          `/user_account/analytics?start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}&metric_types=IMPRESSION,PIN_CLICK,OUTBOUND_CLICK,SAVE`
        );

        // Extract summary metrics
        const summary = analyticsResponse.all?.summary_metrics;
        if (summary) {
          impressions = summary.IMPRESSION || 0;
          pinClicks = summary.PIN_CLICK || 0;
          outboundClicks = summary.OUTBOUND_CLICK || 0;
          saves = summary.SAVE || 0;
        }

        // Extract daily breakdown
        for (const day of analyticsResponse.all?.daily_metrics || []) {
          dailyBreakdown.push({
            date: day.date,
            impressions: day.metrics?.IMPRESSION || 0,
            engagements: (day.metrics?.PIN_CLICK || 0) + (day.metrics?.SAVE || 0),
          });
        }
      } catch (error: unknown) {
        // 403 typically means personal account (not business) — handle gracefully
        if (error instanceof PlatformError && error.statusCode === 403) {
          logger.warn('[pinterest] Analytics unavailable — likely personal account (403). Returning null metrics.', { error });
        } else {
          logger.warn('[pinterest] Analytics fetch failed, continuing with profile data', { error });
        }
      }

      // Get follower count from profile as a supplement
      let followers = 0;
      let following = 0;
      let pinCount = 0;

      try {
        const profile = await this.makeRequest<PinterestUserAccount>('/user_account');
        followers = profile.follower_count || 0;
        following = profile.following_count || 0;
        pinCount = profile.pin_count || 0;
      } catch {
        // Ignore profile fetch failure for analytics
      }

      const engagements = pinClicks + outboundClicks + saves;

      return {
        success: true,
        metrics: {
          impressions,
          engagements,
          followers,
          following,
          posts: pinCount,
          shares: saves,
        },
        period: {
          start: startDate,
          end: endDate,
        },
        breakdown: {
          daily: dailyBreakdown.length > 0 ? dailyBreakdown : undefined,
        },
      };
    } catch (error: unknown) {
      logger.error('Pinterest analytics sync failed', { error });
      return {
        success: false,
        metrics: { impressions: 0, engagements: 0, followers: 0 },
        period: { start: new Date(), end: new Date() },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Sync posts (pins) from Pinterest
   *
   * GET /v5/pins with page_size and optional bookmark for pagination
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

      let endpoint = `/pins?page_size=${Math.min(limit, 50)}`;
      if (cursor) {
        endpoint += `&bookmark=${encodeURIComponent(cursor)}`;
      }

      const response = await this.makeRequest<PinterestPinsResponse>(endpoint);

      const posts = (response.items || []).map((pin) => {
        // Extract the best image URL
        const mediaUrls: string[] = [];
        if (pin.media?.images) {
          // Prefer original or largest image
          const imageKeys = Object.keys(pin.media.images);
          const bestKey = imageKeys.includes('originals')
            ? 'originals'
            : imageKeys[imageKeys.length - 1];
          if (bestKey && pin.media.images[bestKey]) {
            mediaUrls.push(pin.media.images[bestKey].url);
          }
        }

        return {
          id: pin.id,
          platformId: pin.id,
          content: pin.description || pin.title || '',
          mediaUrls,
          publishedAt: new Date(pin.created_at || Date.now()),
          metrics: {
            likes: 0, // Pinterest uses saves, not likes
            comments: 0, // Not available in pin list
            shares: pin.pin_metrics?.save || 0,
            impressions: pin.pin_metrics?.impression || 0,
          },
          url: `https://www.pinterest.com/pin/${pin.id}/`,
        };
      });

      const nextBookmark = response.bookmark;

      return {
        success: true,
        posts,
        total: posts.length,
        hasMore: !!nextBookmark,
        cursor: nextBookmark,
      };
    } catch (error: unknown) {
      logger.error('Pinterest posts sync failed', { error });
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
   * Sync profile information from Pinterest
   *
   * GET /v5/user_account
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

      const account = await this.makeRequest<PinterestUserAccount>('/user_account');

      return {
        success: true,
        profile: {
          id: account.id,
          username: account.username || '',
          displayName: account.business_name || account.username || '',
          avatarUrl: account.profile_image || '',
          followers: account.follower_count || 0,
          following: account.following_count || 0,
          postsCount: account.pin_count || 0,
          verified: false, // Pinterest API v5 doesn't expose verification status
          url: account.username
            ? `https://www.pinterest.com/${account.username}/`
            : '',
        },
      };
    } catch (error: unknown) {
      logger.error('Pinterest profile sync failed', { error });
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
   * Create a new Pinterest pin
   *
   * POST /v5/pins with board_id (REQUIRED), title, description, link, alt_text, media_source
   * Pinterest pins MUST belong to a board.
   * board_id comes from content metadata or must be provided.
   */
  async createPost(content: PostContent): Promise<PostResult> {
    try {
      if (!this.isConfigured()) {
        return { success: false, error: 'Service not configured' };
      }

      // Extract boardId from metadata — required for Pinterest
      const metadata = content.metadata;
      const boardId = metadata?.boardId as string | undefined;

      if (!boardId) {
        return {
          success: false,
          error: 'Pinterest pins require a board_id. Please specify a board to pin to.',
        };
      }

      // Build pin creation payload
      const pinPayload: Record<string, unknown> = {
        board_id: boardId,
        title: (metadata?.title as string) || '',
        description: content.text || '',
        link: content.linkUrl || (metadata?.link as string) || '',
        alt_text: (metadata?.altText as string) || '',
      };

      // Add media source if media URLs provided
      if (content.mediaUrls && content.mediaUrls.length > 0) {
        const mediaUrl = content.mediaUrls[0];
        const isVideo = /\.(mp4|mov|avi|webm)$/i.test(mediaUrl);

        if (isVideo) {
          // Video pins require pre-upload — use video_id source type
          // For URL-based creation, treat as image or return error
          return {
            success: false,
            error: 'Pinterest video pins require pre-upload. Please use image URLs for direct pin creation.',
          };
        } else {
          pinPayload.media_source = {
            source_type: 'image_url',
            url: mediaUrl,
          };
        }
      }

      const result = await this.makeRequest<PinterestPinCreateResponse>('/pins', {
        method: 'POST',
        body: JSON.stringify(pinPayload),
      });

      if (!result.id) {
        return { success: false, error: 'Failed to create Pinterest pin — no pin ID returned' };
      }

      return {
        success: true,
        postId: result.id,
        url: `https://www.pinterest.com/pin/${result.id}/`,
      };
    } catch (error: unknown) {
      logger.error('Pinterest post creation failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete a Pinterest pin
   *
   * DELETE /v5/pins/{pin_id} — returns 204 on success
   */
  async deletePost(postId: string): Promise<boolean> {
    try {
      if (!this.isConfigured()) {
        return false;
      }

      await this.makeRequest<Record<string, never>>(`/pins/${postId}`, {
        method: 'DELETE',
      });

      return true;
    } catch (error: unknown) {
      logger.error('Pinterest pin deletion failed', { error, postId });
      return false;
    }
  }

  /**
   * Get metrics for a specific Pinterest pin
   *
   * GET /v5/pins/{pin_id}/analytics with metric_types=IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK
   * Date range defaults to last 30 days.
   */
  async getPostMetrics(postId: string): Promise<PinterestPostMetrics | null> {
    try {
      if (!this.isConfigured()) {
        return null;
      }

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      const response = await this.makeRequest<PinterestPinAnalyticsResponse>(
        `/pins/${postId}/analytics?start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}&metric_types=IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK`
      );

      const summary = response.all?.summary_metrics;

      return {
        impressions: summary?.IMPRESSION || 0,
        saves: summary?.SAVE || 0,
        pinClicks: summary?.PIN_CLICK || 0,
        outboundClicks: summary?.OUTBOUND_CLICK || 0,
      };
    } catch (error: unknown) {
      logger.error('Pinterest pin metrics fetch failed', { error, postId });
      return null;
    }
  }

  /**
   * Get user's boards
   *
   * GET /v5/boards — returns list of boards with id, name, privacy
   * Used by API route to provide board selection for pin creation.
   */
  async getBoards(): Promise<Array<{ id: string; name: string; privacy: string }>> {
    try {
      if (!this.isConfigured()) {
        return [];
      }

      const response = await this.makeRequest<PinterestBoardsResponse>('/boards');

      return (response.items || []).map((board) => ({
        id: board.id,
        name: board.name,
        privacy: board.privacy || 'PUBLIC',
      }));
    } catch (error: unknown) {
      logger.error('Pinterest boards fetch failed', { error });
      return [];
    }
  }
}

// Export singleton instance
export const pinterestService = new PinterestService();
