import { PlatformConfig, BasePlatformService } from './base-platform.config';

export const tiktokConfig: PlatformConfig = {
  name: 'tiktok',
  displayName: 'TikTok',
  icon: 'tiktok',
  color: '#FF0050',
  oauth: {
    authorizationUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: [
      'user.info.basic',
      'user.info.profile',
      'user.info.stats',
      'video.list',
      'video.upload',
      'video.publish',
    ],
    clientId: process.env.TIKTOK_CLIENT_ID,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET,
    redirectUri: process.env.TIKTOK_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/callback/tiktok`,
  },
  api: {
    baseUrl: 'https://open.tiktokapis.com',
    version: 'v2',
    endpoints: {
      profile: '/v2/user/info/',
      posts: '/v2/video/list/',
      publish: '/v2/post/publish/video/init/',
      media: '/v2/post/publish/content/init/',
      analytics: '/v2/video/data/',
      comments: '/v2/video/comment/list/',
    },
    rateLimit: {
      requests: 1000,
      window: 86400000, // 24 hours
    },
  },
  content: {
    maxLength: 2200, // TikTok caption limit
    maxImages: 35, // For photo mode posts
    maxVideos: 1,
    imageFormats: ['jpg', 'jpeg', 'png', 'webp'],
    videoFormats: ['mp4', 'mov', 'webm'],
    maxImageSize: 20, // 20MB
    maxVideoSize: 4096, // 4GB
    maxVideoDuration: 600, // 10 minutes for verified accounts
    features: {
      hashtags: true,
      mentions: true,
      links: false, // TikTok doesn't allow clickable links in captions
      stories: false,
      reels: true, // TikTok videos are essentially reels
      polls: false, // Limited poll features
      threads: false,
    },
  },
  analytics: {
    metrics: [
      'video_views',
      'profile_views',
      'likes',
      'comments',
      'shares',
      'video_duration_watched',
      'video_watched_full',
      'reach',
      'engagement_rate',
    ],
    refreshInterval: 3600000, // 1 hour
  },
};

export class TikTokService extends BasePlatformService {
  constructor() {
    super(tiktokConfig);
  }
  
  async authenticate(code: string): Promise<any> {
    const body = {
      client_key: this.config.oauth.clientId!,
      client_secret: this.config.oauth.clientSecret!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.config.oauth.redirectUri!,
    };
    
    const response = await fetch(this.config.oauth.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: new URLSearchParams(body),
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`TikTok OAuth error: ${data.error_description || data.error}`);
    }
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      openId: data.open_id,
      scope: data.scope,
    };
  }
  
  async refreshToken(refreshToken: string): Promise<any> {
    const body = {
      client_key: this.config.oauth.clientId!,
      client_secret: this.config.oauth.clientSecret!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    };
    
    const response = await fetch(this.config.oauth.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body),
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`TikTok token refresh error: ${data.error_description || data.error}`);
    }
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }
  
  async getProfile(accessToken: string): Promise<any> {
    const fields = 'open_id,union_id,avatar_url,display_name,bio_description,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count';
    return this.makeApiRequest(`${this.config.api.endpoints.profile}?fields=${fields}`, accessToken);
  }
  
  async publishPost(accessToken: string, content: any): Promise<any> {
    this.validateContent(content);
    
    if (!content.videoFile && !content.images) {
      throw new Error('TikTok requires either a video file or images for photo mode');
    }
    
    if (content.videoFile) {
      return this.publishVideo(accessToken, content);
    } else if (content.images && content.images.length > 0) {
      return this.publishPhotoPost(accessToken, content);
    }
    
    throw new Error('Invalid content type for TikTok');
  }
  
  async publishVideo(accessToken: string, content: any): Promise<any> {
    // Step 1: Initialize video upload
    const initData = {
      post_info: {
        title: content.text || '',
        privacy_level: content.privacy || 'MUTUAL_FOLLOW_FRIENDS',
        disable_duet: content.disableDuet || false,
        disable_comment: content.disableComment || false,
        disable_stitch: content.disableStitch || false,
        video_cover_timestamp_ms: content.coverTimestamp || 1000,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: content.videoFile,
      },
    };
    
    const response = await this.makeApiRequest(
      this.config.api.endpoints.publish,
      accessToken,
      'POST',
      initData
    );
    
    if (response.error) {
      throw new Error(`TikTok video upload error: ${response.error.message}`);
    }
    
    return {
      publishId: response.data.publish_id,
      uploadUrl: response.data.upload_url,
      status: 'processing',
    };
  }
  
  async publishPhotoPost(accessToken: string, content: any): Promise<any> {
    const photoData = {
      post_info: {
        title: content.text || '',
        privacy_level: content.privacy || 'MUTUAL_FOLLOW_FRIENDS',
        disable_comment: content.disableComment || false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_images: content.images.map((url: string) => ({ image_url: url })),
      },
    };
    
    const response = await this.makeApiRequest(
      '/v2/post/publish/content/init/',
      accessToken,
      'POST',
      photoData
    );
    
    if (response.error) {
      throw new Error(`TikTok photo post error: ${response.error.message}`);
    }
    
    return {
      publishId: response.data.publish_id,
      status: 'processing',
    };
  }
  
  async getVideoList(accessToken: string, cursor?: number, maxCount: number = 20): Promise<any> {
    const params = new URLSearchParams({
      fields: 'id,title,video_description,duration,cover_image_url,embed_html,embed_link,like_count,comment_count,share_count,view_count',
      max_count: maxCount.toString(),
    });
    
    if (cursor) {
      params.append('cursor', cursor.toString());
    }
    
    return this.makeApiRequest(
      `${this.config.api.endpoints.posts}?${params}`,
      accessToken
    );
  }
  
  async getAnalytics(accessToken: string, postId: string): Promise<any> {
    const fields = this.config.analytics.metrics.join(',');
    return this.makeApiRequest(
      `${this.config.api.endpoints.analytics}?fields=${fields}&video_ids=${postId}`,
      accessToken
    );
  }
  
  async deletePost(accessToken: string, postId: string): Promise<boolean> {
    // TikTok API doesn't currently support deleting videos programmatically
    // This would need to be done manually through the TikTok app
    throw new Error('TikTok API does not support programmatic video deletion');
  }
  
  async schedulePost(accessToken: string, content: any, scheduledTime: Date): Promise<any> {
    // TikTok doesn't currently support scheduled posting through API
    // Would need third-party scheduling service or manual posting
    throw new Error('TikTok API does not support scheduled posting');
  }
  
  async getPublishStatus(accessToken: string, publishId: string): Promise<any> {
    return this.makeApiRequest(
      `/v2/post/publish/status/fetch/?publish_id=${publishId}`,
      accessToken
    );
  }
  
  protected formatContent(content: any): any {
    // TikTok-specific content formatting
    const formatted = { ...content };
    
    // Extract hashtags for better reach
    if (formatted.text && formatted.text.includes('#')) {
      const hashtags = formatted.text.match(/#[\w\u4e00-\u9fff]+/g) || [];
      formatted.hashtags = hashtags;
    }
    
    // Ensure video requirements
    if (formatted.videoFile && !formatted.coverTimestamp) {
      formatted.coverTimestamp = 1000; // Default to 1 second for cover
    }
    
    return formatted;
  }
}