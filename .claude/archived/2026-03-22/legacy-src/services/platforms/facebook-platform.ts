import axios, { AxiosInstance } from 'axios';
import { BasePlatformService, PlatformConfig, BasePlatformPost, PlatformPostResponse, PlatformAnalyticsResponse, PlatformAnalytics, PLATFORM_LIMITS, SupportedPlatforms } from './base-platform';

/**
 * Facebook Platform Service
 *
 * Uses Meta Graph API for Facebook Pages.
 * Requires a Facebook Page with appropriate permissions.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - FACEBOOK_CLIENT_ID (for OAuth)
 * - FACEBOOK_CLIENT_SECRET (for OAuth)
 *
 * @module src/services/platforms/facebook-platform
 */

export interface FacebookConfig extends PlatformConfig {
  accessToken: string;
  pageId: string;
  pageAccessToken?: string; // Page-specific access token (preferred)
}

interface FacebookPostResponse {
  id: string;
  post_id?: string;
}

interface FacebookPostInsights {
  data: Array<{
    name: string;
    period: string;
    values: Array<{ value: number | Record<string, number> }>;
    title: string;
    description: string;
    id: string;
  }>;
}

interface FacebookPostData {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  shares?: { count: number };
  reactions?: { summary: { total_count: number } };
  comments?: { summary: { total_count: number } };
}

export class FacebookPlatformService extends BasePlatformService {
  private apiClient: AxiosInstance;
  private lastRequestTime: Date = new Date(0);
  private readonly minRequestInterval = 2000; // 2 seconds between requests
  private readonly graphApiVersion = 'v18.0';

  constructor(config: FacebookConfig) {
    super(SupportedPlatforms.FACEBOOK, config);

    // Use page access token if available, otherwise user access token
    const token = config.pageAccessToken || config.accessToken;

    this.apiClient = axios.create({
      baseURL: `https://graph.facebook.com/${this.graphApiVersion}`,
      params: {
        access_token: token,
      },
    });
  }

  async validateConfig(): Promise<boolean> {
    const config = this.config as FacebookConfig;
    const requiredFields = ['accessToken', 'pageId'];

    if (!this.validateRequiredConfig(requiredFields)) {
      return false;
    }

    try {
      // Test API access by getting page info
      const response = await this.apiClient.get(`/${config.pageId}`, {
        params: {
          fields: 'id,name,category',
        },
      });
      return response.status === 200 && response.data?.id;
    } catch (error) {
      console.error('Facebook config validation failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);
      const config = this.config as FacebookConfig;

      const response = await this.apiClient.get(`/${config.pageId}`, {
        params: {
          fields: 'id,name',
        },
      });

      this.lastRequestTime = new Date();
      return response.status === 200;
    } catch (error) {
      console.error('Facebook connection test failed:', error);
      return false;
    }
  }

  async publishPost(post: BasePlatformPost): Promise<PlatformPostResponse> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);

      const config = this.config as FacebookConfig;
      const limits = PLATFORM_LIMITS[SupportedPlatforms.FACEBOOK];
      const truncatedContent = this.truncateContent(post.content, limits.textLimit);
      const message = this.formatHashtags(truncatedContent);

      let response: { data: FacebookPostResponse };

      if (post.mediaUrls && post.mediaUrls.length > 0) {
        if (post.mediaUrls.length === 1) {
          // Single photo/video post
          const mediaUrl = post.mediaUrls[0];
          const isVideo = this.isVideoUrl(mediaUrl);

          if (isVideo) {
            response = await this.publishVideoPost(config.pageId, mediaUrl, message);
          } else {
            response = await this.publishPhotoPost(config.pageId, mediaUrl, message);
          }
        } else {
          // Multiple photos - use multipost
          response = await this.publishMultiPhotoPost(
            config.pageId,
            post.mediaUrls.slice(0, limits.mediaLimit),
            message
          );
        }
      } else {
        // Text-only post
        response = await this.apiClient.post<FacebookPostResponse>(
          `/${config.pageId}/feed`,
          null,
          {
            params: {
              message,
            },
          }
        );
      }

      this.lastRequestTime = new Date();

      if (response.data?.id || response.data?.post_id) {
        const postId = response.data.post_id || response.data.id;

        return {
          success: true,
          platformPostId: postId,
          url: `https://facebook.com/${postId}`,
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
    try {
      if (!post.scheduledAt) {
        return {
          success: false,
          error: 'Scheduled time is required for scheduling posts',
        };
      }

      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);

      const config = this.config as FacebookConfig;
      const limits = PLATFORM_LIMITS[SupportedPlatforms.FACEBOOK];
      const truncatedContent = this.truncateContent(post.content, limits.textLimit);
      const message = this.formatHashtags(truncatedContent);

      // Facebook supports scheduled posts via published=false and scheduled_publish_time
      const scheduledTime = Math.floor(post.scheduledAt.getTime() / 1000);

      const params: Record<string, any> = {
        message,
        published: false,
        scheduled_publish_time: scheduledTime,
      };

      // Add photo if provided
      if (post.mediaUrls && post.mediaUrls.length > 0) {
        params.url = post.mediaUrls[0];
      }

      const response = await this.apiClient.post<FacebookPostResponse>(
        `/${config.pageId}/feed`,
        null,
        { params }
      );

      this.lastRequestTime = new Date();

      if (response.data?.id) {
        return {
          success: true,
          platformPostId: response.data.id,
          scheduledFor: post.scheduledAt,
        };
      } else {
        return {
          success: false,
          error: 'Failed to schedule post',
        };
      }
    } catch (error) {
      return this.handleApiError(error, 'schedule post') as PlatformPostResponse;
    }
  }

  async deletePost(platformPostId: string): Promise<boolean> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);

      const response = await this.apiClient.delete(`/${platformPostId}`);
      this.lastRequestTime = new Date();

      return response.status === 200 || response.data?.success;
    } catch (error) {
      console.error('Failed to delete Facebook post:', error);
      return false;
    }
  }

  async getAnalytics(platformPostId: string): Promise<PlatformAnalyticsResponse> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);

      // Get post insights
      const insightsResponse = await this.apiClient.get<FacebookPostInsights>(
        `/${platformPostId}/insights`,
        {
          params: {
            metric: 'post_impressions,post_impressions_unique,post_engaged_users,post_clicks,post_reactions_by_type_total',
          },
        }
      );

      // Get basic post metrics
      const postResponse = await this.apiClient.get<FacebookPostData>(
        `/${platformPostId}`,
        {
          params: {
            fields: 'shares,reactions.summary(total_count),comments.summary(total_count),permalink_url',
          },
        }
      );

      this.lastRequestTime = new Date();

      const insightsData = insightsResponse.data?.data || [];
      const postData = postResponse.data;

      // Parse insights
      const getInsightValue = (name: string): number => {
        const insight = insightsData.find(i => i.name === name);
        const value = insight?.values?.[0]?.value;
        return typeof value === 'number' ? value : 0;
      };

      const impressions = getInsightValue('post_impressions');
      const reach = getInsightValue('post_impressions_unique');
      const engagedUsers = getInsightValue('post_engaged_users');
      const clicks = getInsightValue('post_clicks');

      const analytics: PlatformAnalytics = {
        postId: platformPostId,
        platformPostId: platformPostId,
        views: impressions,
        likes: postData.reactions?.summary?.total_count || 0,
        shares: postData.shares?.count || 0,
        comments: postData.comments?.summary?.total_count || 0,
        clicks: clicks,
        impressions: impressions,
        reach: reach,
        engagementRate: reach > 0 ? (engagedUsers / reach) * 100 : 0,
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

  private async publishPhotoPost(
    pageId: string,
    photoUrl: string,
    message: string
  ): Promise<{ data: FacebookPostResponse }> {
    return this.apiClient.post<FacebookPostResponse>(
      `/${pageId}/photos`,
      null,
      {
        params: {
          url: photoUrl,
          caption: message,
          published: true,
        },
      }
    );
  }

  private async publishVideoPost(
    pageId: string,
    videoUrl: string,
    message: string
  ): Promise<{ data: FacebookPostResponse }> {
    return this.apiClient.post<FacebookPostResponse>(
      `/${pageId}/videos`,
      null,
      {
        params: {
          file_url: videoUrl,
          description: message,
          published: true,
        },
      }
    );
  }

  private async publishMultiPhotoPost(
    pageId: string,
    photoUrls: string[],
    message: string
  ): Promise<{ data: FacebookPostResponse }> {
    // First, upload each photo as unpublished
    const photoIds: string[] = [];

    for (const url of photoUrls) {
      const uploadResponse = await this.apiClient.post<{ id: string }>(
        `/${pageId}/photos`,
        null,
        {
          params: {
            url,
            published: false,
          },
        }
      );

      if (uploadResponse.data?.id) {
        photoIds.push(uploadResponse.data.id);
      }
    }

    // Create multi-photo post
    const attachedMedia = photoIds.map(id => ({ media_fbid: id }));

    return this.apiClient.post<FacebookPostResponse>(
      `/${pageId}/feed`,
      null,
      {
        params: {
          message,
          attached_media: JSON.stringify(attachedMedia),
        },
      }
    );
  }

  private isVideoUrl(url: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const lowercaseUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowercaseUrl.includes(ext));
  }

  // Additional Facebook-specific methods

  async getPageInfo(): Promise<any> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);
      const config = this.config as FacebookConfig;

      const response = await this.apiClient.get(`/${config.pageId}`, {
        params: {
          fields: 'id,name,category,fan_count,followers_count,about,description,website,picture',
        },
      });

      this.lastRequestTime = new Date();
      return response.data;
    } catch (error) {
      console.error('Failed to get Facebook page info:', error);
      return null;
    }
  }

  async getPagePosts(limit = 10): Promise<any[]> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);
      const config = this.config as FacebookConfig;

      const response = await this.apiClient.get(`/${config.pageId}/posts`, {
        params: {
          fields: 'id,message,created_time,permalink_url,shares,reactions.summary(total_count),comments.summary(total_count)',
          limit,
        },
      });

      this.lastRequestTime = new Date();
      return response.data?.data || [];
    } catch (error) {
      console.error('Failed to get Facebook page posts:', error);
      return [];
    }
  }

  async getPageInsights(period: 'day' | 'week' | 'days_28' = 'week'): Promise<any> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);
      const config = this.config as FacebookConfig;

      const response = await this.apiClient.get(`/${config.pageId}/insights`, {
        params: {
          metric: 'page_impressions,page_engaged_users,page_fans,page_views_total',
          period,
        },
      });

      this.lastRequestTime = new Date();
      return response.data?.data || [];
    } catch (error) {
      console.error('Failed to get Facebook page insights:', error);
      return [];
    }
  }
}

export default FacebookPlatformService;
