import axios, { AxiosInstance } from 'axios';
import { BasePlatformService, PlatformConfig, BasePlatformPost, PlatformPostResponse, PlatformAnalyticsResponse, PlatformAnalytics, PLATFORM_LIMITS, SupportedPlatforms } from './base-platform';

// Twitter API v2 configuration
export interface TwitterConfig extends PlatformConfig {
  bearerToken: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

interface TwitterMediaUpload {
  media_id_string: string;
  size: number;
  expires_after_secs: number;
  image?: {
    w: number;
    h: number;
    image_type: string;
  };
  video?: {
    video_type: string;
  };
}

interface TwitterTweetResponse {
  data: {
    id: string;
    text: string;
  };
}

interface TwitterTweetMetrics {
  impression_count?: number;
  like_count?: number;
  reply_count?: number;
  retweet_count?: number;
  quote_count?: number;
  bookmark_count?: number;
  url_link_clicks?: number;
  user_profile_clicks?: number;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    bookmark_count: number;
    impression_count: number;
  };
}

export class TwitterPlatformService extends BasePlatformService {
  private apiClient: AxiosInstance;
  private uploadClient: AxiosInstance;
  private lastRequestTime: Date = new Date(0);
  private readonly minRequestInterval = 1000; // 1 second between requests

  constructor(config: TwitterConfig) {
    super(SupportedPlatforms.TWITTER, config);
    
    // Initialize API clients
    this.apiClient = axios.create({
      baseURL: 'https://api.twitter.com/2',
      headers: {
        'Authorization': `Bearer ${config.bearerToken}`,
        'Content-Type': 'application/json',
      },
    });

    this.uploadClient = axios.create({
      baseURL: 'https://upload.twitter.com/1.1',
      headers: {
        'Authorization': this.generateOAuthHeader(),
        'Content-Type': 'application/json',
      },
    });
  }

  private generateOAuthHeader(): string {
    const config = this.config as TwitterConfig;
    // For OAuth 1.0a signature - simplified version
    // In production, use a proper OAuth library like 'oauth-1.0a'
    return `OAuth oauth_consumer_key="${config.apiKey}", oauth_token="${config.accessToken}"`;
  }

  async validateConfig(): Promise<boolean> {
    const config = this.config as TwitterConfig;
    const requiredFields = ['bearerToken', 'apiKey', 'apiSecret', 'accessToken', 'accessTokenSecret'];
    
    if (!this.validateRequiredConfig(requiredFields)) {
      return false;
    }

    try {
      // Test API access by getting user info
      const response = await this.apiClient.get('/users/me');
      return response.status === 200;
    } catch (error) {
      console.error('Twitter config validation failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);
      const response = await this.apiClient.get('/users/me');
      this.lastRequestTime = new Date();
      return response.status === 200;
    } catch (error) {
      console.error('Twitter connection test failed:', error);
      return false;
    }
  }

  async publishPost(post: BasePlatformPost): Promise<PlatformPostResponse> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);

      const limits = PLATFORM_LIMITS[SupportedPlatforms.TWITTER];
      const truncatedContent = this.truncateContent(post.content, limits.textLimit);
      
      let mediaIds: string[] = [];
      
      // Upload media if provided
      if (post.mediaUrls && post.mediaUrls.length > 0) {
        mediaIds = await this.uploadMedia(post.mediaUrls.slice(0, limits.mediaLimit));
      }

      const tweetData: any = {
        text: this.formatHashtags(truncatedContent),
      };

      // Add media if uploaded
      if (mediaIds.length > 0) {
        tweetData.media = {
          media_ids: mediaIds
        };
      }

      const response = await this.apiClient.post<TwitterTweetResponse>('/tweets', tweetData);
      this.lastRequestTime = new Date();

      if (response.data?.data?.id) {
        return {
          success: true,
          platformPostId: response.data.data.id,
          url: `https://twitter.com/i/web/status/${response.data.data.id}`,
        };
      } else {
        return {
          success: false,
          error: 'Failed to get tweet ID from response',
        };
      }
    } catch (error) {
      return this.handleApiError(error, 'publish tweet') as PlatformPostResponse;
    }
  }

  async schedulePost(post: BasePlatformPost): Promise<PlatformPostResponse> {
    // Twitter API v2 doesn't support native scheduling
    // This would typically be handled by a scheduling service
    return {
      success: false,
      error: 'Twitter API v2 does not support native post scheduling. Use a scheduling service.',
    };
  }

  async deletePost(platformPostId: string): Promise<boolean> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);
      
      const response = await this.apiClient.delete(`/tweets/${platformPostId}`);
      this.lastRequestTime = new Date();
      
      return response.status === 200;
    } catch (error) {
      console.error('Failed to delete Twitter post:', error);
      return false;
    }
  }

  async getAnalytics(platformPostId: string): Promise<PlatformAnalyticsResponse> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);

      // Get tweet metrics
      const response = await this.apiClient.get(`/tweets/${platformPostId}`, {
        params: {
          'tweet.fields': 'public_metrics,non_public_metrics,organic_metrics,promoted_metrics,context_annotations',
          'expansions': 'attachments.media_keys,author_id',
        }
      });

      this.lastRequestTime = new Date();

      const tweetData = response.data?.data;
      if (!tweetData) {
        return {
          success: false,
          error: 'Tweet not found or no metrics available',
        };
      }

      const metrics: TwitterTweetMetrics = {
        ...tweetData.public_metrics,
        ...tweetData.non_public_metrics,
        ...tweetData.organic_metrics,
      };

      const analytics: PlatformAnalytics = {
        postId: platformPostId,
        platformPostId: platformPostId,
        views: metrics.impression_count || 0,
        likes: metrics.like_count || 0,
        shares: (metrics.retweet_count || 0) + (metrics.quote_count || 0),
        comments: metrics.reply_count || 0,
        clicks: metrics.url_link_clicks || 0,
        impressions: metrics.impression_count || 0,
        reach: metrics.impression_count || 0, // Twitter doesn't provide reach separately
        engagementRate: this.calculateEngagementRate(metrics),
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

  private async uploadMedia(mediaUrls: string[]): Promise<string[]> {
    const uploadedIds: string[] = [];

    for (const url of mediaUrls) {
      try {
        // Download media first
        const mediaResponse = await axios.get(url, { responseType: 'arraybuffer' });
        const mediaBuffer = Buffer.from(mediaResponse.data);
        
        // Upload to Twitter
        const uploadResponse = await this.uploadClient.post<TwitterMediaUpload>('/media/upload.json', {
          media_data: mediaBuffer.toString('base64'),
        }, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        if (uploadResponse.data?.media_id_string) {
          uploadedIds.push(uploadResponse.data.media_id_string);
        }
      } catch (error) {
        console.error('Failed to upload media to Twitter:', error);
        // Continue with other media files
      }
    }

    return uploadedIds;
  }

  private calculateEngagementRate(metrics: TwitterTweetMetrics): number {
    const impressions = metrics.impression_count || metrics.public_metrics?.impression_count || 0;
    if (impressions === 0) return 0;

    const engagements = 
      (metrics.like_count || metrics.public_metrics?.like_count || 0) +
      (metrics.retweet_count || metrics.public_metrics?.retweet_count || 0) +
      (metrics.reply_count || metrics.public_metrics?.reply_count || 0) +
      (metrics.quote_count || metrics.public_metrics?.quote_count || 0);

    return (engagements / impressions) * 100;
  }

  // Additional Twitter-specific methods
  async getTweetById(tweetId: string): Promise<any> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);
      
      const response = await this.apiClient.get(`/tweets/${tweetId}`, {
        params: {
          'tweet.fields': 'created_at,author_id,context_annotations,conversation_id,public_metrics',
          'expansions': 'author_id,attachments.media_keys',
          'user.fields': 'name,username,verified',
          'media.fields': 'type,url,preview_image_url',
        }
      });

      this.lastRequestTime = new Date();
      return response.data;
    } catch (error) {
      console.error('Failed to get Twitter post:', error);
      return null;
    }
  }

  async getUserInfo(): Promise<any> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);
      
      const response = await this.apiClient.get('/users/me', {
        params: {
          'user.fields': 'created_at,description,entities,id,location,name,pinned_tweet_id,profile_image_url,protected,public_metrics,url,username,verified',
        }
      });

      this.lastRequestTime = new Date();
      return response.data?.data;
    } catch (error) {
      console.error('Failed to get Twitter user info:', error);
      return null;
    }
  }
}

export default TwitterPlatformService;
