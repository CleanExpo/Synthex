/**
 * Instagram Platform Service
 *
 * @description Instagram API integration via Facebook Graph API
 * Supports Instagram Business and Creator accounts connected to Facebook Pages
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - FACEBOOK_APP_ID: Facebook app ID (SECRET)
 * - FACEBOOK_APP_SECRET: Facebook app secret (SECRET)
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

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

export class InstagramService extends BasePlatformService {
  readonly platform = 'instagram';
  private igUserId: string | null = null;

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Ensure token is valid before making request (auto-refresh if needed)
    await this.ensureValidToken();

    if (!this.credentials?.accessToken) {
      throw new PlatformError('instagram', 'No access token configured');
    }

    // Add access token to URL
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${GRAPH_API_BASE}${endpoint}${separator}access_token=${this.credentials.accessToken}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });

      const data = await response.json();

      // Check for token expiry error and attempt refresh
      if (data.error?.code === 190 || data.error?.error_subcode === 463) {
        // Token expired - try to refresh and retry
        logger.warn('[instagram] Token expired during request, attempting refresh...', {
          errorCode: data.error?.code,
          errorSubcode: data.error?.error_subcode,
        });

        try {
          await this.refreshToken();
          // Retry the request with new token
          const retryUrl = `${GRAPH_API_BASE}${endpoint}${separator}access_token=${this.credentials.accessToken}`;
          const retryResponse = await fetch(retryUrl, {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              ...(options.headers || {}),
            },
          });
          const retryData = await retryResponse.json();

          if (!retryResponse.ok || retryData.error) {
            throw new PlatformError(
              'instagram',
              retryData.error?.message || `API request failed after token refresh: ${retryResponse.status}`,
              retryResponse.status
            );
          }
          return retryData;
        } catch (refreshError) {
          logger.error('[instagram] Token refresh failed during retry', { error: refreshError });
          throw new PlatformError(
            'instagram',
            'Token expired and refresh failed. Please re-authenticate.',
            401
          );
        }
      }

      if (!response.ok || data.error) {
        throw new PlatformError(
          'instagram',
          data.error?.message || `API request failed: ${response.status}`,
          response.status
        );
      }

      return data;
    } catch (error: unknown) {
      if (error instanceof PlatformError) throw error;
      const originalError = error instanceof Error ? error : undefined;
      throw new PlatformError('instagram', error instanceof Error ? error.message : String(error), undefined, originalError);
    }
  }

  /**
   * Override canRefreshToken to indicate Instagram supports token refresh
   * Instagram uses long-lived tokens that can be exchanged
   */
  protected override canRefreshToken(): boolean {
    return !!this.credentials?.accessToken;
  }

  /**
   * Get the Instagram Business Account ID from Facebook Page
   */
  private async getInstagramAccountId(): Promise<string> {
    if (this.igUserId) return this.igUserId;

    // First, get the Facebook pages the user has access to
    const pagesResponse = await this.makeRequest<any>('/me/accounts?fields=id,name,instagram_business_account');

    // Find a page with an Instagram business account connected
    const pageWithInstagram = pagesResponse.data?.find(
      (page: any) => page.instagram_business_account?.id
    );

    if (!pageWithInstagram) {
      throw new PlatformError(
        'instagram',
        'No Instagram Business Account found. Please connect an Instagram Business or Creator account to a Facebook Page.'
      );
    }

    this.igUserId = pageWithInstagram.instagram_business_account.id;
    return this.igUserId!;
  }

  async validateCredentials(): Promise<boolean> {
    try {
      await this.getInstagramAccountId();
      return true;
    } catch (error) {
      logger.error('Instagram credentials validation failed', { error });
      return false;
    }
  }

  async refreshToken(): Promise<PlatformCredentials> {
    if (!this.credentials?.accessToken) {
      throw new PlatformError('instagram', 'No access token to refresh');
    }

    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      throw new PlatformError('instagram', 'Facebook app credentials not configured');
    }

    try {
      // Exchange for long-lived token
      const response = await fetch(
        `${GRAPH_API_BASE}/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${appId}&` +
        `client_secret=${appSecret}&` +
        `fb_exchange_token=${this.credentials.accessToken}`
      );

      const data = await response.json();

      if (data.error) {
        throw new PlatformError('instagram', data.error.message || 'Instagram API error');
      }

      const newCredentials: PlatformCredentials = {
        ...this.credentials,
        accessToken: data.access_token,
        expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000), // Default 60 days
      };

      this.credentials = newCredentials;
      return newCredentials;
    } catch (error: unknown) {
      throw new PlatformError('instagram', `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`);
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

      const igAccountId = await this.getInstagramAccountId();
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      // Get account insights
      const period = days <= 1 ? 'day' : days <= 7 ? 'week' : 'days_28';
      const metricsToFetch = [
        'impressions',
        'reach',
        'follower_count',
        'profile_views',
        'website_clicks',
      ].join(',');

      let impressions = 0;
      let reach = 0;
      let followers = 0;
      let profileViews = 0;

      try {
        const insightsResponse = await this.makeRequest<any>(
          `/${igAccountId}/insights?metric=${metricsToFetch}&period=${period}`
        );

        for (const insight of insightsResponse.data || []) {
          const value = insight.values?.[0]?.value || 0;
          switch (insight.name) {
            case 'impressions':
              impressions = value;
              break;
            case 'reach':
              reach = value;
              break;
            case 'follower_count':
              followers = value;
              break;
            case 'profile_views':
              profileViews = value;
              break;
          }
        }
      } catch (error) {
        logger.warn('Instagram insights fetch failed, using profile data', { error });
      }

      // Fallback: Get follower count from profile if insights failed
      if (followers === 0) {
        try {
          const profile = await this.makeRequest<any>(
            `/${igAccountId}?fields=followers_count`
          );
          followers = profile.followers_count || 0;
        } catch {
          // Ignore
        }
      }

      // Get daily breakdown for impressions
      const dailyBreakdown: Array<{ date: string; impressions: number; engagements: number }> = [];

      try {
        const since = Math.floor(startDate.getTime() / 1000);
        const until = Math.floor(endDate.getTime() / 1000);

        const dailyInsights = await this.makeRequest<any>(
          `/${igAccountId}/insights?metric=impressions,reach&period=day&since=${since}&until=${until}`
        );

        const impressionsData = dailyInsights.data?.find((d: any) => d.name === 'impressions');
        if (impressionsData?.values) {
          for (const value of impressionsData.values) {
            dailyBreakdown.push({
              date: value.end_time?.split('T')[0] || '',
              impressions: value.value || 0,
              engagements: 0,
            });
          }
        }
      } catch {
        // Daily breakdown not available
      }

      // Calculate engagements from recent posts
      let engagements = 0;
      try {
        const mediaResponse = await this.makeRequest<any>(
          `/${igAccountId}/media?fields=like_count,comments_count&limit=50`
        );

        for (const media of mediaResponse.data || []) {
          engagements += (media.like_count || 0) + (media.comments_count || 0);
        }
      } catch {
        // Engagement calculation failed
      }

      return {
        success: true,
        metrics: {
          impressions,
          engagements,
          followers,
          reach,
          profileViews,
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
      logger.error('Instagram analytics sync failed', { error });
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

      const igAccountId = await this.getInstagramAccountId();

      // Build query
      const fields = [
        'id',
        'caption',
        'media_type',
        'media_url',
        'thumbnail_url',
        'permalink',
        'timestamp',
        'like_count',
        'comments_count',
        'insights.metric(impressions,reach,engagement)',
      ].join(',');

      let endpoint = `/${igAccountId}/media?fields=${fields}&limit=${limit}`;
      if (cursor) {
        endpoint += `&after=${cursor}`;
      }

      const response = await this.makeRequest<any>(endpoint);

      const posts = (response.data || []).map((media: any) => {
        // Extract insights
        let impressions = 0;
        let reach = 0;
        let engagement = 0;

        if (media.insights?.data) {
          for (const insight of media.insights.data) {
            switch (insight.name) {
              case 'impressions':
                impressions = insight.values?.[0]?.value || 0;
                break;
              case 'reach':
                reach = insight.values?.[0]?.value || 0;
                break;
              case 'engagement':
                engagement = insight.values?.[0]?.value || 0;
                break;
            }
          }
        }

        return {
          id: media.id,
          platformId: media.id,
          content: media.caption || '',
          mediaUrls: media.media_url ? [media.media_url] : [],
          publishedAt: new Date(media.timestamp),
          metrics: {
            likes: media.like_count || 0,
            comments: media.comments_count || 0,
            shares: 0, // Instagram doesn't expose shares
            impressions,
            reach,
          },
          url: media.permalink,
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
      logger.error('Instagram posts sync failed', { error });
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

      const igAccountId = await this.getInstagramAccountId();

      const profile = await this.makeRequest<any>(
        `/${igAccountId}?fields=id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count,website`
      );

      return {
        success: true,
        profile: {
          id: profile.id,
          username: profile.username,
          displayName: profile.name || profile.username,
          bio: profile.biography || '',
          avatarUrl: profile.profile_picture_url || '',
          followers: profile.followers_count || 0,
          following: profile.follows_count || 0,
          postsCount: profile.media_count || 0,
          verified: false, // Not available via API
          url: `https://www.instagram.com/${profile.username}`,
        },
      };
    } catch (error: unknown) {
      logger.error('Instagram profile sync failed', { error });
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

      const igAccountId = await this.getInstagramAccountId();

      // Instagram requires media for all posts
      if (!content.mediaUrls || content.mediaUrls.length === 0) {
        return {
          success: false,
          error: 'Instagram posts require at least one image or video',
        };
      }

      // Create media container
      const mediaUrl = content.mediaUrls[0];
      const isVideo = mediaUrl.match(/\.(mp4|mov|avi)$/i);

      const containerResponse = await this.makeRequest<any>(
        `/${igAccountId}/media`,
        {
          method: 'POST',
          body: JSON.stringify({
            [isVideo ? 'video_url' : 'image_url']: mediaUrl,
            caption: content.text,
            media_type: isVideo ? 'VIDEO' : 'IMAGE',
          }),
        }
      );

      if (!containerResponse.id) {
        return { success: false, error: 'Failed to create media container' };
      }

      // Wait for container to be ready (for videos)
      if (isVideo) {
        let ready = false;
        let attempts = 0;
        while (!ready && attempts < 30) {
          await this.sleep(2000);
          const status = await this.makeRequest<any>(
            `/${containerResponse.id}?fields=status_code`
          );
          if (status.status_code === 'FINISHED') {
            ready = true;
          } else if (status.status_code === 'ERROR') {
            return { success: false, error: 'Video processing failed' };
          }
          attempts++;
        }
      }

      // Publish the container
      const publishResponse = await this.makeRequest<any>(
        `/${igAccountId}/media_publish`,
        {
          method: 'POST',
          body: JSON.stringify({
            creation_id: containerResponse.id,
          }),
        }
      );

      return {
        success: true,
        postId: publishResponse.id,
        url: `https://www.instagram.com/p/${publishResponse.id}`,
      };
    } catch (error: unknown) {
      logger.error('Instagram post creation failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deletePost(postId: string): Promise<boolean> {
    // Instagram Graph API doesn't support deleting posts
    logger.warn('Instagram post deletion not supported via API', { postId });
    return false;
  }

  async getPostMetrics(postId: string): Promise<any> {
    try {
      if (!this.isConfigured()) {
        return null;
      }

      const response = await this.makeRequest<any>(
        `/${postId}?fields=like_count,comments_count,insights.metric(impressions,reach,engagement,saved)`
      );

      let impressions = 0;
      let reach = 0;
      let engagement = 0;
      let saved = 0;

      if (response.insights?.data) {
        for (const insight of response.insights.data) {
          switch (insight.name) {
            case 'impressions':
              impressions = insight.values?.[0]?.value || 0;
              break;
            case 'reach':
              reach = insight.values?.[0]?.value || 0;
              break;
            case 'engagement':
              engagement = insight.values?.[0]?.value || 0;
              break;
            case 'saved':
              saved = insight.values?.[0]?.value || 0;
              break;
          }
        }
      }

      return {
        likes: response.like_count || 0,
        comments: response.comments_count || 0,
        impressions,
        reach,
        engagement,
        saved,
      };
    } catch (error: unknown) {
      logger.error('Instagram post metrics fetch failed', { error, postId });
      return null;
    }
  }
}

// Export singleton instance
export const instagramService = new InstagramService();
