import { PlatformConfig, BasePlatformService } from './base-platform.config';

export const instagramConfig: PlatformConfig = {
  name: 'instagram',
  displayName: 'Instagram',
  icon: 'instagram',
  color: '#E4405F',
  oauth: {
    authorizationUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scopes: [
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
      'instagram_manage_insights',
      'pages_show_list',
      'pages_read_engagement',
    ],
    clientId: process.env.INSTAGRAM_CLIENT_ID,
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/callback/instagram`,
  },
  api: {
    baseUrl: 'https://graph.instagram.com',
    version: 'v18.0',
    endpoints: {
      profile: '/me',
      posts: '/me/media',
      publish: '/me/media',
      media: '/me/media',
      analytics: '/insights',
      comments: '/comments',
    },
    rateLimit: {
      requests: 200,
      window: 3600000, // 1 hour
    },
  },
  content: {
    maxLength: 2200,
    maxImages: 10, // carousel posts
    maxVideos: 1,
    imageFormats: ['jpg', 'jpeg', 'png'],
    videoFormats: ['mp4', 'mov'],
    maxImageSize: 8, // 8MB
    maxVideoSize: 100, // 100MB for feed, 650MB for IGTV
    maxVideoDuration: 60, // 60 seconds for feed, 10 minutes for IGTV
    features: {
      hashtags: true,
      mentions: true,
      links: false, // Links only in bio
      stories: true,
      reels: true,
      polls: true,
      threads: false,
    },
  },
  analytics: {
    metrics: [
      'impressions',
      'reach',
      'engagement',
      'saved',
      'video_views',
      'likes',
      'comments',
      'shares',
    ],
    refreshInterval: 3600000, // 1 hour
  },
};

export class InstagramService extends BasePlatformService {
  constructor() {
    super(instagramConfig);
  }
  
  async authenticate(code: string): Promise<any> {
    // Instagram uses Facebook's OAuth system
    const params = new URLSearchParams({
      client_id: this.config.oauth.clientId!,
      client_secret: this.config.oauth.clientSecret!,
      grant_type: 'authorization_code',
      redirect_uri: this.config.oauth.redirectUri!,
      code,
    });
    
    const response = await fetch(this.config.oauth.tokenUrl, {
      method: 'POST',
      body: params,
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Instagram OAuth error: ${data.error_message}`);
    }
    
    // Exchange for long-lived token
    const longLivedResponse = await fetch(
      `https://graph.instagram.com/access_token?` +
      `grant_type=ig_exchange_token&` +
      `client_secret=${this.config.oauth.clientSecret}&` +
      `access_token=${data.access_token}`
    );
    
    const longLivedData = await longLivedResponse.json();
    
    return {
      accessToken: longLivedData.access_token,
      expiresIn: longLivedData.expires_in,
    };
  }
  
  async refreshToken(refreshToken: string): Promise<any> {
    // Instagram uses long-lived tokens that need to be refreshed before expiry
    const response = await fetch(
      `https://graph.instagram.com/refresh_access_token?` +
      `grant_type=ig_refresh_token&` +
      `access_token=${refreshToken}`
    );
    
    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  }
  
  async getProfile(accessToken: string): Promise<any> {
    const fields = 'id,username,account_type,media_count,followers_count';
    return this.makeApiRequest(`/me?fields=${fields}`, accessToken);
  }
  
  async getBusinessAccount(accessToken: string): Promise<any> {
    // Get Instagram Business Account ID from Facebook Page
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?` +
      `fields=instagram_business_account&` +
      `access_token=${accessToken}`
    );
    
    const data = await response.json();
    return data.data[0]?.instagram_business_account;
  }
  
  async publishPost(accessToken: string, content: any): Promise<any> {
    this.validateContent(content);
    
    // Step 1: Create media container
    let containerId;
    
    if (content.images && content.images.length > 0) {
      if (content.images.length === 1) {
        // Single image post
        containerId = await this.createImageContainer(
          accessToken,
          content.images[0],
          content.text
        );
      } else {
        // Carousel post
        containerId = await this.createCarouselContainer(
          accessToken,
          content.images,
          content.text
        );
      }
    } else if (content.video) {
      // Video post or reel
      containerId = await this.createVideoContainer(
        accessToken,
        content.video,
        content.text,
        content.isReel
      );
    } else {
      throw new Error('Instagram requires at least one image or video');
    }
    
    // Step 2: Publish the container
    return this.publishContainer(accessToken, containerId);
  }
  
  async createImageContainer(
    accessToken: string,
    imageUrl: string,
    caption: string
  ): Promise<string> {
    const response = await this.makeApiRequest(
      '/me/media',
      accessToken,
      'POST',
      {
        image_url: imageUrl,
        caption: this.formatCaption(caption),
      }
    );
    
    return response.id;
  }
  
  async createVideoContainer(
    accessToken: string,
    videoUrl: string,
    caption: string,
    isReel: boolean = false
  ): Promise<string> {
    const params: any = {
      video_url: videoUrl,
      caption: this.formatCaption(caption),
    };
    
    if (isReel) {
      params.media_type = 'REELS';
    }
    
    const response = await this.makeApiRequest(
      '/me/media',
      accessToken,
      'POST',
      params
    );
    
    return response.id;
  }
  
  async createCarouselContainer(
    accessToken: string,
    imageUrls: string[],
    caption: string
  ): Promise<string> {
    // Create individual item containers
    const itemIds = [];
    
    for (const imageUrl of imageUrls) {
      const response = await this.makeApiRequest(
        '/me/media',
        accessToken,
        'POST',
        {
          image_url: imageUrl,
          is_carousel_item: true,
        }
      );
      itemIds.push(response.id);
    }
    
    // Create carousel container
    const carouselResponse = await this.makeApiRequest(
      '/me/media',
      accessToken,
      'POST',
      {
        media_type: 'CAROUSEL',
        children: itemIds.join(','),
        caption: this.formatCaption(caption),
      }
    );
    
    return carouselResponse.id;
  }
  
  async publishContainer(accessToken: string, containerId: string): Promise<any> {
    return this.makeApiRequest(
      '/me/media_publish',
      accessToken,
      'POST',
      {
        creation_id: containerId,
      }
    );
  }
  
  formatCaption(text: string): string {
    // Add hashtags formatting if needed
    let formattedText = text;
    
    // Ensure hashtags are properly formatted
    formattedText = formattedText.replace(/#(\w+)/g, '#$1');
    
    // Limit to 2200 characters
    if (formattedText.length > this.config.content.maxLength) {
      formattedText = formattedText.substring(0, this.config.content.maxLength - 3) + '...';
    }
    
    return formattedText;
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
    // Instagram doesn't support native scheduling via API
    // Store in database and use cron job to publish
    throw new Error('Instagram scheduling must be handled by the application');
  }
  
  async getStories(accessToken: string): Promise<any> {
    return this.makeApiRequest('/me/stories', accessToken);
  }
  
  async publishStory(accessToken: string, mediaUrl: string, mediaType: 'IMAGE' | 'VIDEO'): Promise<any> {
    const response = await this.makeApiRequest(
      '/me/media',
      accessToken,
      'POST',
      {
        media_type: mediaType,
        [`${mediaType.toLowerCase()}_url`]: mediaUrl,
      }
    );
    
    return this.publishContainer(accessToken, response.id);
  }
}