import axios, { AxiosInstance } from 'axios';
import { BasePlatformService, PlatformConfig, BasePlatformPost, PlatformPostResponse, PlatformAnalyticsResponse, PlatformAnalytics, PLATFORM_LIMITS, SupportedPlatforms } from './base-platform';

/**
 * Instagram Platform Service
 *
 * Uses Meta Graph API for Instagram Business/Creator accounts.
 * Requires a Facebook Page connected to an Instagram Business account.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - FACEBOOK_CLIENT_ID (for OAuth)
 * - FACEBOOK_CLIENT_SECRET (for OAuth)
 *
 * @module src/services/platforms/instagram-platform
 */

export interface InstagramConfig extends PlatformConfig {
  accessToken: string;
  instagramAccountId: string;
  pageId?: string; // Facebook Page ID (required for some operations)
}

interface InstagramMediaContainer {
  id: string;
}

interface InstagramPublishResponse {
  id: string;
}

interface InstagramInsights {
  data: Array<{
    name: string;
    period: string;
    values: Array<{ value: number }>;
    title: string;
    description: string;
    id: string;
  }>;
}

interface InstagramMediaResponse {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

export class InstagramPlatformService extends BasePlatformService {
  private apiClient: AxiosInstance;
  private lastRequestTime: Date = new Date(0);
  private readonly minRequestInterval = 2000; // 2 seconds between requests (Meta rate limits)
  private readonly graphApiVersion = 'v18.0';

  constructor(config: InstagramConfig) {
    super(SupportedPlatforms.INSTAGRAM, config);

    this.apiClient = axios.create({
      baseURL: `https://graph.facebook.com/${this.graphApiVersion}`,
      params: {
        access_token: config.accessToken,
      },
    });
  }

  async validateConfig(): Promise<boolean> {
    const config = this.config as InstagramConfig;
    const requiredFields = ['accessToken', 'instagramAccountId'];

    if (!this.validateRequiredConfig(requiredFields)) {
      return false;
    }

    try {
      // Test API access by getting account info
      const response = await this.apiClient.get(`/${config.instagramAccountId}`, {
        params: {
          fields: 'id,username,account_type',
        },
      });
      return response.status === 200 && response.data?.id;
    } catch (error) {
      console.error('Instagram config validation failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);
      const config = this.config as InstagramConfig;

      const response = await this.apiClient.get(`/${config.instagramAccountId}`, {
        params: {
          fields: 'id,username',
        },
      });

      this.lastRequestTime = new Date();
      return response.status === 200;
    } catch (error) {
      console.error('Instagram connection test failed:', error);
      return false;
    }
  }

  async publishPost(post: BasePlatformPost): Promise<PlatformPostResponse> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);

      const config = this.config as InstagramConfig;
      const limits = PLATFORM_LIMITS[SupportedPlatforms.INSTAGRAM];
      const truncatedContent = this.truncateContent(post.content, limits.textLimit);
      const caption = this.formatHashtags(truncatedContent);

      // Instagram requires media - check if we have any
      if (!post.mediaUrls || post.mediaUrls.length === 0) {
        return {
          success: false,
          error: 'Instagram requires at least one image or video for posts',
        };
      }

      // Determine media type and create container
      const mediaUrl = post.mediaUrls[0];
      const isVideo = this.isVideoUrl(mediaUrl);

      let containerId: string;

      if (post.mediaUrls.length === 1) {
        // Single media post
        containerId = await this.createMediaContainer(
          config.instagramAccountId,
          mediaUrl,
          caption,
          isVideo ? 'VIDEO' : 'IMAGE'
        );
      } else {
        // Carousel post (multiple images/videos)
        containerId = await this.createCarouselContainer(
          config.instagramAccountId,
          post.mediaUrls.slice(0, limits.mediaLimit),
          caption
        );
      }

      // Publish the container
      const publishResponse = await this.apiClient.post<InstagramPublishResponse>(
        `/${config.instagramAccountId}/media_publish`,
        null,
        {
          params: {
            creation_id: containerId,
          },
        }
      );

      this.lastRequestTime = new Date();

      if (publishResponse.data?.id) {
        // Get the permalink
        const mediaInfo = await this.getMediaInfo(publishResponse.data.id);

        return {
          success: true,
          platformPostId: publishResponse.data.id,
          url: mediaInfo?.permalink || `https://instagram.com/p/${publishResponse.data.id}`,
        };
      } else {
        return {
          success: false,
          error: 'Failed to get post ID from response',
        };
      }
    } catch (error) {
      return this.handleApiError(error, 'publish post') as PlatformPostResponse;
    }
  }

  async schedulePost(post: BasePlatformPost): Promise<PlatformPostResponse> {
    // Instagram Content Publishing API doesn't support native scheduling
    return {
      success: false,
      error: 'Instagram API does not support native post scheduling. Use a scheduling service.',
    };
  }

  async deletePost(platformPostId: string): Promise<boolean> {
    // Instagram Graph API doesn't support deleting posts
    // Posts must be deleted manually through the app
    console.warn('Instagram API does not support post deletion via API');
    return false;
  }

  async getAnalytics(platformPostId: string): Promise<PlatformAnalyticsResponse> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);

      // Get media insights
      const insightsResponse = await this.apiClient.get<InstagramInsights>(
        `/${platformPostId}/insights`,
        {
          params: {
            metric: 'impressions,reach,engagement,saved,video_views',
          },
        }
      );

      // Get basic media metrics
      const mediaResponse = await this.apiClient.get<InstagramMediaResponse>(
        `/${platformPostId}`,
        {
          params: {
            fields: 'like_count,comments_count,media_type,permalink',
          },
        }
      );

      this.lastRequestTime = new Date();

      const insightsData = insightsResponse.data?.data || [];
      const mediaData = mediaResponse.data;

      // Parse insights
      const getInsightValue = (name: string): number => {
        const insight = insightsData.find(i => i.name === name);
        return insight?.values?.[0]?.value || 0;
      };

      const impressions = getInsightValue('impressions');
      const reach = getInsightValue('reach');
      const engagement = getInsightValue('engagement');
      const saved = getInsightValue('saved');
      const videoViews = getInsightValue('video_views');

      const analytics: PlatformAnalytics = {
        postId: platformPostId,
        platformPostId: platformPostId,
        views: videoViews || impressions,
        likes: mediaData.like_count || 0,
        shares: saved, // Instagram doesn't have shares, using saves
        comments: mediaData.comments_count || 0,
        clicks: 0, // Not available for regular posts
        impressions: impressions,
        reach: reach,
        engagementRate: reach > 0 ? (engagement / reach) * 100 : 0,
        updatedAt: new Date(),
      };

      return {
        success: true,
        analytics,
      };
    } catch (error) {
      return this.handleApiError(error, 'get analytics') as PlatformAnalyticsResponse;
    }
  }

  // Helper methods

  private async createMediaContainer(
    accountId: string,
    mediaUrl: string,
    caption: string,
    mediaType: 'IMAGE' | 'VIDEO' | 'REELS'
  ): Promise<string> {
    const params: Record<string, string> = {
      caption,
    };

    if (mediaType === 'VIDEO' || mediaType === 'REELS') {
      params.media_type = mediaType;
      params.video_url = mediaUrl;
    } else {
      params.image_url = mediaUrl;
    }

    const response = await this.apiClient.post<InstagramMediaContainer>(
      `/${accountId}/media`,
      null,
      { params }
    );

    if (!response.data?.id) {
      throw new Error('Failed to create media container');
    }

    // Wait for media processing (Instagram needs time to process uploads)
    await this.waitForMediaProcessing(response.data.id);

    return response.data.id;
  }

  private async createCarouselContainer(
    accountId: string,
    mediaUrls: string[],
    caption: string
  ): Promise<string> {
    // First, create individual media items
    const childrenIds: string[] = [];

    for (const url of mediaUrls) {
      const isVideo = this.isVideoUrl(url);
      const params: Record<string, string> = {
        is_carousel_item: 'true',
      };

      if (isVideo) {
        params.media_type = 'VIDEO';
        params.video_url = url;
      } else {
        params.image_url = url;
      }

      const response = await this.apiClient.post<InstagramMediaContainer>(
        `/${accountId}/media`,
        null,
        { params }
      );

      if (response.data?.id) {
        await this.waitForMediaProcessing(response.data.id);
        childrenIds.push(response.data.id);
      }
    }

    // Create carousel container
    const carouselResponse = await this.apiClient.post<InstagramMediaContainer>(
      `/${accountId}/media`,
      null,
      {
        params: {
          media_type: 'CAROUSEL',
          caption,
          children: childrenIds.join(','),
        },
      }
    );

    if (!carouselResponse.data?.id) {
      throw new Error('Failed to create carousel container');
    }

    return carouselResponse.data.id;
  }

  private async waitForMediaProcessing(containerId: string, maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await this.apiClient.get(`/${containerId}`, {
        params: {
          fields: 'status_code',
        },
      });

      const status = response.data?.status_code;

      if (status === 'FINISHED') {
        return;
      } else if (status === 'ERROR') {
        throw new Error('Media processing failed');
      }

      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Media processing timed out');
  }

  private async getMediaInfo(mediaId: string): Promise<InstagramMediaResponse | null> {
    try {
      const response = await this.apiClient.get<InstagramMediaResponse>(`/${mediaId}`, {
        params: {
          fields: 'id,caption,media_type,media_url,permalink,timestamp',
        },
      });
      return response.data;
    } catch {
      return null;
    }
  }

  private isVideoUrl(url: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const lowercaseUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowercaseUrl.includes(ext));
  }

  // Additional Instagram-specific methods

  async getUserInfo(): Promise<any> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);
      const config = this.config as InstagramConfig;

      const response = await this.apiClient.get(`/${config.instagramAccountId}`, {
        params: {
          fields: 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website',
        },
      });

      this.lastRequestTime = new Date();
      return response.data;
    } catch (error) {
      console.error('Failed to get Instagram user info:', error);
      return null;
    }
  }

  async getRecentMedia(limit = 10): Promise<any[]> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);
      const config = this.config as InstagramConfig;

      const response = await this.apiClient.get(`/${config.instagramAccountId}/media`, {
        params: {
          fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count',
          limit,
        },
      });

      this.lastRequestTime = new Date();
      return response.data?.data || [];
    } catch (error) {
      console.error('Failed to get Instagram recent media:', error);
      return [];
    }
  }
}

export default InstagramPlatformService;
