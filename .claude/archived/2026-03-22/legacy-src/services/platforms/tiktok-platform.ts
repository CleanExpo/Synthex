import axios, { AxiosInstance } from 'axios';
import { BasePlatformService, PlatformConfig, BasePlatformPost, PlatformPostResponse, PlatformAnalyticsResponse, PlatformAnalytics, PLATFORM_LIMITS, SupportedPlatforms } from './base-platform';

/**
 * TikTok Platform Service
 *
 * Uses TikTok Content Posting API for publishing videos.
 * Note: TikTok only supports video content, not images or text-only posts.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - TIKTOK_CLIENT_KEY (for OAuth)
 * - TIKTOK_CLIENT_SECRET (for OAuth)
 *
 * @module src/services/platforms/tiktok-platform
 */

export interface TikTokConfig extends PlatformConfig {
  accessToken: string;
  openId: string; // TikTok user's open_id
  refreshToken?: string;
}

interface TikTokVideoInitResponse {
  data: {
    publish_id: string;
    upload_url: string;
  };
  error: {
    code: string;
    message: string;
    log_id: string;
  };
}

interface TikTokPublishStatusResponse {
  data: {
    status: 'PROCESSING_DOWNLOAD' | 'PROCESSING_UPLOAD' | 'SEND_TO_USER_INBOX' | 'PUBLISH_COMPLETE' | 'FAILED';
    fail_reason?: string;
    publicaly_available_post_id?: string[];
  };
  error: {
    code: string;
    message: string;
    log_id: string;
  };
}

interface TikTokVideoInfo {
  id: string;
  create_time: number;
  cover_image_url: string;
  share_url: string;
  video_description: string;
  duration: number;
  height: number;
  width: number;
  title: string;
  embed_html: string;
  embed_link: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  view_count: number;
}

export class TikTokPlatformService extends BasePlatformService {
  private apiClient: AxiosInstance;
  private lastRequestTime: Date = new Date(0);
  private readonly minRequestInterval = 3000; // 3 seconds between requests (TikTok is strict)
  private readonly apiVersion = 'v2';

  constructor(config: TikTokConfig) {
    super(SupportedPlatforms.TIKTOK, config);

    this.apiClient = axios.create({
      baseURL: `https://open.tiktokapis.com/${this.apiVersion}`,
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async validateConfig(): Promise<boolean> {
    const config = this.config as TikTokConfig;
    const requiredFields = ['accessToken', 'openId'];

    if (!this.validateRequiredConfig(requiredFields)) {
      return false;
    }

    try {
      // Test API access by getting user info
      const response = await this.apiClient.get('/user/info/', {
        params: {
          fields: 'open_id,display_name',
        },
      });
      return response.status === 200 && response.data?.data?.user;
    } catch (error) {
      console.error('TikTok config validation failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);

      const response = await this.apiClient.get('/user/info/', {
        params: {
          fields: 'open_id,display_name',
        },
      });

      this.lastRequestTime = new Date();
      return response.status === 200 && !response.data?.error?.code;
    } catch (error) {
      console.error('TikTok connection test failed:', error);
      return false;
    }
  }

  async publishPost(post: BasePlatformPost): Promise<PlatformPostResponse> {
    try {
      // TikTok only supports video posts
      if (!post.mediaUrls || post.mediaUrls.length === 0) {
        return {
          success: false,
          error: 'TikTok requires a video URL for posting. Image and text-only posts are not supported.',
        };
      }

      const videoUrl = post.mediaUrls[0];

      // Validate it's a video
      if (!this.isVideoUrl(videoUrl)) {
        return {
          success: false,
          error: 'TikTok only supports video content. Please provide a video file.',
        };
      }

      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);

      const limits = PLATFORM_LIMITS[SupportedPlatforms.TIKTOK];
      const truncatedContent = this.truncateContent(post.content, limits.textLimit);
      const caption = this.formatHashtags(truncatedContent);

      // Initialize the video upload
      const initResponse = await this.initializeVideoUpload(videoUrl, caption);

      if (!initResponse.data?.publish_id) {
        return {
          success: false,
          error: initResponse.error?.message || 'Failed to initialize video upload',
        };
      }

      const publishId = initResponse.data.publish_id;

      // Poll for publish status
      const publishResult = await this.waitForPublishComplete(publishId);

      this.lastRequestTime = new Date();

      if (publishResult.data?.status === 'PUBLISH_COMPLETE') {
        const postId = publishResult.data.publicaly_available_post_id?.[0];

        return {
          success: true,
          platformPostId: postId || publishId,
          url: postId ? `https://www.tiktok.com/@user/video/${postId}` : undefined,
        };
      } else {
        return {
          success: false,
          error: publishResult.data?.fail_reason || 'Video publishing failed',
        };
      }
    } catch (error) {
      return this.handleApiError(error, 'publish video') as PlatformPostResponse;
    }
  }

  async schedulePost(post: BasePlatformPost): Promise<PlatformPostResponse> {
    // TikTok Content Posting API doesn't support native scheduling
    return {
      success: false,
      error: 'TikTok API does not support native post scheduling. Use a scheduling service.',
    };
  }

  async deletePost(platformPostId: string): Promise<boolean> {
    // TikTok Content Posting API doesn't support deleting posts
    console.warn('TikTok API does not support post deletion via API');
    return false;
  }

  async getAnalytics(platformPostId: string): Promise<PlatformAnalyticsResponse> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);

      // Get video info using the Video Query API
      const response = await this.apiClient.post('/video/query/', {
        filters: {
          video_ids: [platformPostId],
        },
        fields: [
          'id',
          'title',
          'video_description',
          'create_time',
          'share_url',
          'like_count',
          'comment_count',
          'share_count',
          'view_count',
        ],
      });

      this.lastRequestTime = new Date();

      const videoData = response.data?.data?.videos?.[0] as TikTokVideoInfo | undefined;

      if (!videoData) {
        return {
          success: false,
          error: 'Video not found or no metrics available',
        };
      }

      const analytics: PlatformAnalytics = {
        postId: platformPostId,
        platformPostId: platformPostId,
        views: videoData.view_count || 0,
        likes: videoData.like_count || 0,
        shares: videoData.share_count || 0,
        comments: videoData.comment_count || 0,
        clicks: 0, // TikTok doesn't provide click data
        impressions: videoData.view_count || 0, // Using views as impressions
        reach: 0, // TikTok doesn't provide reach data publicly
        engagementRate: this.calculateEngagementRate(videoData),
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

  private async initializeVideoUpload(
    videoUrl: string,
    caption: string
  ): Promise<TikTokVideoInitResponse> {
    // TikTok supports two methods: pull from URL or direct upload
    // Using pull from URL method for simplicity
    const response = await this.apiClient.post<TikTokVideoInitResponse>(
      '/post/publish/video/init/',
      {
        post_info: {
          title: caption.substring(0, 150), // TikTok title limit
          privacy_level: 'PUBLIC_TO_EVERYONE', // or 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: videoUrl,
        },
      }
    );

    return response.data;
  }

  private async waitForPublishComplete(
    publishId: string,
    maxAttempts = 30
  ): Promise<TikTokPublishStatusResponse> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const response = await this.apiClient.post<TikTokPublishStatusResponse>(
        '/post/publish/status/fetch/',
        {
          publish_id: publishId,
        }
      );

      const status = response.data?.data?.status;

      if (status === 'PUBLISH_COMPLETE' || status === 'FAILED') {
        return response.data;
      }

      // Continue polling for other statuses (PROCESSING_DOWNLOAD, PROCESSING_UPLOAD, SEND_TO_USER_INBOX)
    }

    return {
      data: {
        status: 'FAILED',
        fail_reason: 'Publish status check timed out',
      },
      error: {
        code: 'TIMEOUT',
        message: 'Publishing timed out',
        log_id: '',
      },
    };
  }

  private isVideoUrl(url: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
    const lowercaseUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowercaseUrl.includes(ext));
  }

  private calculateEngagementRate(video: TikTokVideoInfo): number {
    const views = video.view_count || 0;
    if (views === 0) return 0;

    const engagements =
      (video.like_count || 0) +
      (video.comment_count || 0) +
      (video.share_count || 0);

    return (engagements / views) * 100;
  }

  // Additional TikTok-specific methods

  async getUserInfo(): Promise<any> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);

      const response = await this.apiClient.get('/user/info/', {
        params: {
          fields: 'open_id,union_id,avatar_url,avatar_url_100,avatar_large_url,display_name,bio_description,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count',
        },
      });

      this.lastRequestTime = new Date();
      return response.data?.data?.user;
    } catch (error) {
      console.error('Failed to get TikTok user info:', error);
      return null;
    }
  }

  async getUserVideos(maxCount = 20): Promise<any[]> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);

      const response = await this.apiClient.post('/video/list/', {
        max_count: maxCount,
        fields: [
          'id',
          'title',
          'video_description',
          'create_time',
          'cover_image_url',
          'share_url',
          'like_count',
          'comment_count',
          'share_count',
          'view_count',
          'duration',
        ],
      });

      this.lastRequestTime = new Date();
      return response.data?.data?.videos || [];
    } catch (error) {
      console.error('Failed to get TikTok user videos:', error);
      return [];
    }
  }

  async getCreatorInfo(): Promise<any> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);

      // This endpoint requires creator marketplace access
      const response = await this.apiClient.get('/research/user/info/', {
        params: {
          fields: 'display_name,follower_count,following_count,likes_count,video_count',
        },
      });

      this.lastRequestTime = new Date();
      return response.data?.data;
    } catch (error) {
      console.error('Failed to get TikTok creator info:', error);
      return null;
    }
  }
}

export default TikTokPlatformService;
