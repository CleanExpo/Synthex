import axios, { AxiosInstance } from 'axios';
import { BasePlatformService, PlatformConfig, BasePlatformPost, PlatformPostResponse, PlatformAnalyticsResponse, PlatformAnalytics, PLATFORM_LIMITS, SupportedPlatforms } from './base-platform';

// LinkedIn API configuration
export interface LinkedInConfig extends PlatformConfig {
  accessToken: string;
  personId?: string;
  organizationId?: string;
}

interface LinkedInPostResponse {
  id: string;
  lifecycleState: string;
}

interface LinkedInMediaUpload {
  asset: string;
  uploadMechanism: {
    'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
      uploadUrl: string;
      headers: Record<string, string>;
    };
  };
}

interface LinkedInPostMetrics {
  impressions?: number;
  clicks?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  engagement?: number;
}

export class LinkedInPlatformService extends BasePlatformService {
  private apiClient: AxiosInstance;
  private lastRequestTime: Date = new Date(0);
  private readonly minRequestInterval = 2000; // 2 seconds between requests for LinkedIn

  constructor(config: LinkedInConfig) {
    super(SupportedPlatforms.LINKEDIN, config);
    
    // Initialize API client
    this.apiClient = axios.create({
      baseURL: 'https://api.linkedin.com/v2',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
  }

  async validateConfig(): Promise<boolean> {
    const config = this.config as LinkedInConfig;
    const requiredFields = ['accessToken'];
    
    if (!this.validateRequiredConfig(requiredFields)) {
      return false;
    }

    try {
      // Test API access by getting user profile
      const response = await this.apiClient.get('/people/~:(id,firstName,lastName)');
      
      // Store person ID for later use if not provided
      if (!config.personId && response.data?.id) {
        config.personId = response.data.id;
      }
      
      return response.status === 200;
    } catch (error) {
      console.error('LinkedIn config validation failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);
      const response = await this.apiClient.get('/people/~:(id,firstName,lastName)');
      this.lastRequestTime = new Date();
      return response.status === 200;
    } catch (error) {
      console.error('LinkedIn connection test failed:', error);
      return false;
    }
  }

  async publishPost(post: BasePlatformPost): Promise<PlatformPostResponse> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);

      const config = this.config as LinkedInConfig;
      const limits = PLATFORM_LIMITS[SupportedPlatforms.LINKEDIN];
      const truncatedContent = this.truncateContent(post.content, limits.textLimit);
      
      // Determine author (person or organization)
      const author = config.organizationId 
        ? `urn:li:organization:${config.organizationId}`
        : `urn:li:person:${config.personId}`;

      let mediaAssets: string[] = [];
      
      // Upload media if provided
      if (post.mediaUrls && post.mediaUrls.length > 0) {
        mediaAssets = await this.uploadMedia(post.mediaUrls.slice(0, limits.mediaLimit));
      }

      // Prepare post data
      const postData: any = {
        author,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: this.formatHashtags(truncatedContent),
            },
            shareMediaCategory: mediaAssets.length > 0 ? 'IMAGE' : 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      // Add media if uploaded
      if (mediaAssets.length > 0) {
        postData.specificContent['com.linkedin.ugc.ShareContent'].media = mediaAssets.map(asset => ({
          status: 'READY',
          media: asset,
        }));
      }

      const response = await this.apiClient.post<LinkedInPostResponse>('/ugcPosts', postData);
      this.lastRequestTime = new Date();

      if (response.data?.id) {
        const postId = response.data.id;
        // Extract the numeric ID from the URN
        const numericId = postId.replace('urn:li:share:', '').replace('urn:li:ugcPost:', '');
        
        return {
          success: true,
          platformPostId: postId,
          url: `https://www.linkedin.com/feed/update/${numericId}/`,
        };
      } else {
        return {
          success: false,
          error: 'Failed to get post ID from response',
        };
      }
    } catch (error) {
      return this.handleApiError(error, 'publish LinkedIn post') as PlatformPostResponse;
    }
  }

  async schedulePost(post: BasePlatformPost): Promise<PlatformPostResponse> {
    // LinkedIn doesn't support native scheduling through API
    // This would need to be handled by a scheduling service
    return {
      success: false,
      error: 'LinkedIn API does not support native post scheduling. Use a scheduling service.',
    };
  }

  async deletePost(platformPostId: string): Promise<boolean> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);
      
      // LinkedIn uses PATCH to update lifecycle state to DELETED
      const response = await this.apiClient.patch(`/ugcPosts/${encodeURIComponent(platformPostId)}`, {
        lifecycleState: 'DELETED'
      });
      
      this.lastRequestTime = new Date();
      return response.status === 200;
    } catch (error) {
      console.error('Failed to delete LinkedIn post:', error);
      return false;
    }
  }

  async getAnalytics(platformPostId: string): Promise<PlatformAnalyticsResponse> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);

      // Get post statistics using the shares API
      const response = await this.apiClient.get(`/socialActions/${encodeURIComponent(platformPostId)}/(comments,likes)`);
      
      // Also try to get impression data if available
      let impressionData;
      try {
        const impressionResponse = await this.apiClient.get('/organizationalEntityShareStatistics', {
          params: {
            q: 'organizationalEntity',
            organizationalEntity: this.config.organizationId || this.config.personId,
            shares: [platformPostId],
          },
        });
        impressionData = impressionResponse.data?.elements?.[0];
      } catch (error: unknown) {
        // Impression data might not be available for personal posts
        const axiosError = error as { response?: { status?: number } };
        console.log('LinkedIn impression data not available:', axiosError.response?.status);
      }

      this.lastRequestTime = new Date();

      const socialData = response.data;
      
      const analytics: PlatformAnalytics = {
        postId: platformPostId,
        platformPostId: platformPostId,
        views: impressionData?.totalShareStatistics?.impressionCount || 0,
        likes: socialData?.likes?.paging?.total || 0,
        shares: impressionData?.totalShareStatistics?.shareCount || 0,
        comments: socialData?.comments?.paging?.total || 0,
        clicks: impressionData?.totalShareStatistics?.clickCount || 0,
        impressions: impressionData?.totalShareStatistics?.impressionCount || 0,
        reach: impressionData?.totalShareStatistics?.uniqueImpressionsCount || 0,
        engagementRate: this.calculateEngagementRate(socialData, impressionData),
        updatedAt: new Date(),
      };

      return {
        success: true,
        analytics,
      };
    } catch (error) {
      return this.handleApiError(error, 'get LinkedIn analytics') as PlatformAnalyticsResponse;
    }
  }

  private async uploadMedia(mediaUrls: string[]): Promise<string[]> {
    const uploadedAssets: string[] = [];

    for (const url of mediaUrls) {
      try {
        // Register upload
        const registerResponse = await this.apiClient.post<LinkedInMediaUpload>('/assets?action=registerUpload', {
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: this.config.organizationId 
              ? `urn:li:organization:${this.config.organizationId}`
              : `urn:li:person:${this.config.personId}`,
          },
        });

        const asset = registerResponse.data?.asset;
        const uploadUrl = registerResponse.data?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;

        if (!asset || !uploadUrl) {
          console.error('Failed to register LinkedIn media upload');
          continue;
        }

        // Download media
        const mediaResponse = await axios.get(url, { responseType: 'arraybuffer' });
        const mediaBuffer = Buffer.from(mediaResponse.data);

        // Upload to LinkedIn
        await axios.put(uploadUrl, mediaBuffer, {
          headers: {
            'Content-Type': 'application/octet-stream',
          },
        });

        uploadedAssets.push(asset);
      } catch (error) {
        console.error('Failed to upload media to LinkedIn:', error);
        // Continue with other media files
      }
    }

    return uploadedAssets;
  }

  private calculateEngagementRate(socialData: any, impressionData: any): number {
    const impressions = impressionData?.totalShareStatistics?.impressionCount || 0;
    if (impressions === 0) return 0;

    const engagements = 
      (socialData?.likes?.paging?.total || 0) +
      (socialData?.comments?.paging?.total || 0) +
      (impressionData?.totalShareStatistics?.shareCount || 0);

    return (engagements / impressions) * 100;
  }

  // Additional LinkedIn-specific methods
  async getProfile(): Promise<any> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);
      
      const response = await this.apiClient.get('/people/~:(id,firstName,lastName,headline,profilePicture,industry,summary)');
      this.lastRequestTime = new Date();
      return response.data;
    } catch (error) {
      console.error('Failed to get LinkedIn profile:', error);
      return null;
    }
  }

  async getOrganizations(): Promise<any> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);
      
      const response = await this.apiClient.get('/organizationAcls', {
        params: {
          q: 'roleAssignee',
          role: 'ADMINISTRATOR',
          projection: '(elements*(organization~(id,name,logoV2)))',
        }
      });
      
      this.lastRequestTime = new Date();
      return response.data?.elements || [];
    } catch (error) {
      console.error('Failed to get LinkedIn organizations:', error);
      return [];
    }
  }

  async getPostById(postId: string): Promise<any> {
    try {
      await this.rateLimit(this.lastRequestTime, this.minRequestInterval);
      
      const response = await this.apiClient.get(`/ugcPosts/${encodeURIComponent(postId)}`);
      this.lastRequestTime = new Date();
      return response.data;
    } catch (error) {
      console.error('Failed to get LinkedIn post:', error);
      return null;
    }
  }
}

export default LinkedInPlatformService;
