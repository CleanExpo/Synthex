import { PlatformConfig, BasePlatformService } from './base-platform.config';

export const facebookConfig: PlatformConfig = {
  name: 'facebook',
  displayName: 'Facebook',
  icon: 'facebook',
  color: '#1877F2',
  oauth: {
    authorizationUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    scopes: [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'pages_manage_metadata',
      'pages_read_user_content',
      'pages_manage_engagement',
      'business_management',
      'instagram_basic',
      'instagram_content_publish',
    ],
    clientId: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    redirectUri: process.env.FACEBOOK_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/callback/facebook`,
  },
  api: {
    baseUrl: 'https://graph.facebook.com/v18.0',
    version: 'v18.0',
    endpoints: {
      profile: '/me',
      posts: '/me/posts',
      publish: '/me/feed',
      media: '/me/photos',
      analytics: '/insights',
      comments: '/comments',
    },
    rateLimit: {
      requests: 200,
      window: 3600000, // 1 hour
    },
  },
  content: {
    maxLength: 63206, // Facebook's max post length
    maxImages: 10,
    maxVideos: 1,
    imageFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    videoFormats: ['mp4', 'mov', 'avi'],
    maxImageSize: 4, // 4MB
    maxVideoSize: 1024, // 1GB
    maxVideoDuration: 240 * 60, // 240 minutes
    features: {
      hashtags: true,
      mentions: true,
      links: true,
      stories: true,
      reels: true,
      polls: true,
      threads: false,
    },
  },
  analytics: {
    metrics: [
      'post_impressions',
      'post_engaged_users',
      'post_clicks',
      'post_reactions_by_type_total',
      'post_video_views',
      'post_video_avg_time_watched',
    ],
    refreshInterval: 3600000, // 1 hour
  },
};

export class FacebookService extends BasePlatformService {
  constructor() {
    super(facebookConfig);
  }
  
  async authenticate(code: string): Promise<any> {
    const params = new URLSearchParams({
      client_id: this.config.oauth.clientId!,
      client_secret: this.config.oauth.clientSecret!,
      code,
      redirect_uri: this.config.oauth.redirectUri!,
    });
    
    const response = await fetch(`${this.config.oauth.tokenUrl}?${params}`);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Facebook OAuth error: ${data.error.message}`);
    }
    
    // Exchange short-lived token for long-lived token
    const longLivedTokenResponse = await fetch(
      `${this.config.api.baseUrl}/oauth/access_token?` +
      `grant_type=fb_exchange_token&` +
      `client_id=${this.config.oauth.clientId}&` +
      `client_secret=${this.config.oauth.clientSecret}&` +
      `fb_exchange_token=${data.access_token}`
    );
    
    const longLivedData = await longLivedTokenResponse.json();
    
    return {
      accessToken: longLivedData.access_token,
      expiresIn: longLivedData.expires_in,
    };
  }
  
  async refreshToken(refreshToken: string): Promise<any> {
    // Facebook uses long-lived tokens, not refresh tokens
    // Long-lived tokens last about 60 days
    return null;
  }
  
  async getProfile(accessToken: string): Promise<any> {
    const fields = 'id,name,email,picture,accounts';
    return this.makeApiRequest(`/me?fields=${fields}`, accessToken);
  }
  
  async getPages(accessToken: string): Promise<any> {
    return this.makeApiRequest('/me/accounts', accessToken);
  }
  
  async publishPost(accessToken: string, content: any): Promise<any> {
    this.validateContent(content);
    
    const postData: any = {
      message: content.text,
    };
    
    if (content.link) {
      postData.link = content.link;
    }
    
    if (content.images && content.images.length > 0) {
      // Upload images first
      const photoIds = await this.uploadImages(accessToken, content.images);
      postData.attached_media = photoIds.map((id: string) => ({ media_fbid: id }));
    }
    
    if (content.pageId) {
      // Post to a specific page
      return this.makeApiRequest(
        `/${content.pageId}/feed`,
        accessToken,
        'POST',
        postData
      );
    }
    
    return this.makeApiRequest(
      this.config.api.endpoints.publish,
      accessToken,
      'POST',
      postData
    );
  }
  
  async uploadImages(accessToken: string, images: string[]): Promise<string[]> {
    const photoIds = [];
    
    for (const imageUrl of images) {
      const response = await this.makeApiRequest(
        this.config.api.endpoints.media!,
        accessToken,
        'POST',
        {
          url: imageUrl,
          published: false,
        }
      );
      photoIds.push(response.id);
    }
    
    return photoIds;
  }
  
  async getAnalytics(accessToken: string, postId: string): Promise<any> {
    const metrics = this.config.analytics.metrics.join(',');
    return this.makeApiRequest(
      `/${postId}/insights?metric=${metrics}`,
      accessToken
    );
  }
  
  async deletePost(accessToken: string, postId: string): Promise<boolean> {
    const response = await this.makeApiRequest(
      `/${postId}`,
      accessToken,
      'DELETE'
    );
    return response.success;
  }
  
  async schedulePost(accessToken: string, content: any, scheduledTime: Date): Promise<any> {
    this.validateContent(content);
    
    const postData: any = {
      message: content.text,
      published: false,
      scheduled_publish_time: Math.floor(scheduledTime.getTime() / 1000),
    };
    
    if (content.link) {
      postData.link = content.link;
    }
    
    return this.makeApiRequest(
      this.config.api.endpoints.publish,
      accessToken,
      'POST',
      postData
    );
  }
}