import { PlatformConfig, BasePlatformService } from './base-platform.config';

export const pinterestConfig: PlatformConfig = {
  name: 'pinterest',
  displayName: 'Pinterest',
  icon: 'pinterest',
  color: '#E60023',
  oauth: {
    authorizationUrl: 'https://www.pinterest.com/oauth/',
    tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    scopes: [
      'ads:read',
      'boards:read',
      'boards:write',
      'pins:read',
      'pins:write',
      'user_accounts:read',
      'catalogs:read',
      'catalogs:write',
    ],
    clientId: process.env.PINTEREST_CLIENT_ID,
    clientSecret: process.env.PINTEREST_CLIENT_SECRET,
    redirectUri: process.env.PINTEREST_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/callback/pinterest`,
  },
  api: {
    baseUrl: 'https://api.pinterest.com/v5',
    version: 'v5',
    endpoints: {
      profile: '/user_account',
      posts: '/pins',
      publish: '/pins',
      media: '/media',
      analytics: '/user_account/analytics',
      comments: '/pins/{pin_id}/comments',
    },
    rateLimit: {
      requests: 1000,
      window: 3600000, // 1 hour
    },
  },
  content: {
    maxLength: 500, // Pinterest pin description limit
    maxImages: 1, // One main image per pin
    maxVideos: 1, // Video pins
    imageFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    videoFormats: ['mp4', 'mov', 'm4v'],
    maxImageSize: 32, // 32MB
    maxVideoSize: 2048, // 2GB
    maxVideoDuration: 900, // 15 minutes
    features: {
      hashtags: true,
      mentions: false,
      links: true,
      stories: true, // Story Pins
      reels: false,
      polls: false,
      threads: false,
    },
  },
  analytics: {
    metrics: [
      'IMPRESSION',
      'PIN_CLICK',
      'OUTBOUND_CLICK',
      'SAVE',
      'SAVE_RATE',
      'PIN_CLICK_RATE',
      'OUTBOUND_CLICK_RATE',
      'TOTAL_COMMENTS',
      'TOTAL_REACTIONS',
    ],
    refreshInterval: 3600000, // 1 hour
  },
};

export class PinterestService extends BasePlatformService {
  constructor() {
    super(pinterestConfig);
  }
  
  async authenticate(code: string): Promise<any> {
    const body = {
      client_id: this.config.oauth.clientId!,
      client_secret: this.config.oauth.clientSecret!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.config.oauth.redirectUri!,
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
      throw new Error(`Pinterest OAuth error: ${data.error_description || data.error}`);
    }
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }
  
  async refreshToken(refreshToken: string): Promise<any> {
    const body = {
      client_id: this.config.oauth.clientId!,
      client_secret: this.config.oauth.clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
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
      throw new Error(`Pinterest token refresh error: ${data.error_description || data.error}`);
    }
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
    };
  }
  
  async getProfile(accessToken: string): Promise<any> {
    return this.makeApiRequest(this.config.api.endpoints.profile, accessToken);
  }
  
  async publishPost(accessToken: string, content: any): Promise<any> {
    this.validateContent(content);
    
    if (!content.imageUrl && !content.videoUrl) {
      throw new Error('Pinterest requires either an image or video URL');
    }
    
    if (!content.boardId) {
      throw new Error('Pinterest requires a board ID to publish a pin');
    }
    
    const pinData: any = {
      board_id: content.boardId,
      description: content.text || '',
    };
    
    // Handle image pins
    if (content.imageUrl) {
      pinData.media_source = {
        source_type: 'image_url',
        url: content.imageUrl,
      };
    }
    
    // Handle video pins
    if (content.videoUrl) {
      pinData.media_source = {
        source_type: 'video_url',
        url: content.videoUrl,
      };
    }
    
    // Add link if provided
    if (content.link) {
      pinData.link = content.link;
    }
    
    // Add title if provided
    if (content.title) {
      pinData.title = content.title;
    }
    
    // Add alt text for accessibility
    if (content.altText) {
      pinData.alt_text = content.altText;
    }
    
    // Add dominant color if provided
    if (content.dominantColor) {
      pinData.dominant_color = content.dominantColor;
    }
    
    return this.makeApiRequest(
      this.config.api.endpoints.publish,
      accessToken,
      'POST',
      pinData
    );
  }
  
  async getBoards(accessToken: string, pageSize: number = 25, bookmark?: string): Promise<any> {
    const params = new URLSearchParams({
      page_size: pageSize.toString(),
    });
    
    if (bookmark) {
      params.append('bookmark', bookmark);
    }
    
    return this.makeApiRequest(`/boards?${params}`, accessToken);
  }
  
  async createBoard(accessToken: string, name: string, description?: string, privacy: string = 'PUBLIC'): Promise<any> {
    const boardData = {
      name,
      description: description || '',
      privacy,
    };
    
    return this.makeApiRequest('/boards', accessToken, 'POST', boardData);
  }
  
  async getPins(accessToken: string, pageSize: number = 25, bookmark?: string): Promise<any> {
    const params = new URLSearchParams({
      page_size: pageSize.toString(),
    });
    
    if (bookmark) {
      params.append('bookmark', bookmark);
    }
    
    return this.makeApiRequest(`${this.config.api.endpoints.posts}?${params}`, accessToken);
  }
  
  async getBoardPins(accessToken: string, boardId: string, pageSize: number = 25, bookmark?: string): Promise<any> {
    const params = new URLSearchParams({
      page_size: pageSize.toString(),
    });
    
    if (bookmark) {
      params.append('bookmark', bookmark);
    }
    
    return this.makeApiRequest(`/boards/${boardId}/pins?${params}`, accessToken);
  }
  
  async updatePin(accessToken: string, pinId: string, updates: any): Promise<any> {
    const updateData: any = {};
    
    if (updates.boardId) {
      updateData.board_id = updates.boardId;
    }
    
    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }
    
    if (updates.title !== undefined) {
      updateData.title = updates.title;
    }
    
    if (updates.link !== undefined) {
      updateData.link = updates.link;
    }
    
    if (updates.altText !== undefined) {
      updateData.alt_text = updates.altText;
    }
    
    return this.makeApiRequest(
      `/pins/${pinId}`,
      accessToken,
      'PATCH',
      updateData
    );
  }
  
  async getAnalytics(accessToken: string, pinId: string): Promise<any> {
    // Pinterest Analytics API for pin-level metrics
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days ago
    const endDate = new Date().toISOString().split('T')[0]; // Today
    
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      metric_types: this.config.analytics.metrics.join(','),
      pin_format: 'ALL',
    });
    
    return this.makeApiRequest(
      `/pins/${pinId}/analytics?${params}`,
      accessToken
    );
  }
  
  async getUserAnalytics(accessToken: string, startDate: string, endDate: string): Promise<any> {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      metric_types: this.config.analytics.metrics.join(','),
      split_field: 'NO_SPLIT',
    });
    
    return this.makeApiRequest(
      `${this.config.api.endpoints.analytics}?${params}`,
      accessToken
    );
  }
  
  async deletePost(accessToken: string, pinId: string): Promise<boolean> {
    const response = await this.makeApiRequest(
      `/pins/${pinId}`,
      accessToken,
      'DELETE'
    );
    
    // Pinterest API returns 204 No Content on successful deletion
    return true;
  }
  
  async schedulePost(accessToken: string, content: any, scheduledTime: Date): Promise<any> {
    // Pinterest doesn't natively support scheduled posting through API
    // This would need to be handled by a scheduling service
    throw new Error('Pinterest API does not support native scheduled posting');
  }
  
  async searchPins(accessToken: string, query: string, limit: number = 10): Promise<any> {
    const params = new URLSearchParams({
      query,
      limit: limit.toString(),
    });
    
    return this.makeApiRequest(`/search/pins?${params}`, accessToken);
  }
  
  async searchBoards(accessToken: string, query: string, limit: number = 10): Promise<any> {
    const params = new URLSearchParams({
      query,
      limit: limit.toString(),
    });
    
    return this.makeApiRequest(`/search/boards?${params}`, accessToken);
  }
  
  async getFollowing(accessToken: string, pageSize: number = 25, bookmark?: string): Promise<any> {
    const params = new URLSearchParams({
      page_size: pageSize.toString(),
    });
    
    if (bookmark) {
      params.append('bookmark', bookmark);
    }
    
    return this.makeApiRequest(`/user_account/following?${params}`, accessToken);
  }
  
  async getFollowers(accessToken: string, pageSize: number = 25, bookmark?: string): Promise<any> {
    const params = new URLSearchParams({
      page_size: pageSize.toString(),
    });
    
    if (bookmark) {
      params.append('bookmark', bookmark);
    }
    
    return this.makeApiRequest(`/user_account/followers?${params}`, accessToken);
  }
  
  public formatContent(content: any): any {
    // Pinterest-specific content formatting
    const formatted = { ...content };
    
    // Ensure description is within limits
    if (formatted.text && formatted.text.length > this.config.content.maxLength) {
      formatted.text = formatted.text.substring(0, this.config.content.maxLength - 3) + '...';
    }
    
    // Extract hashtags and optimize them for Pinterest
    if (formatted.text && formatted.text.includes('#')) {
      const hashtags = formatted.text.match(/#[\w\u4e00-\u9fff]+/g) || [];
      formatted.hashtags = hashtags;
      
      // Pinterest performs better with hashtags at the end
      const textWithoutHashtags = formatted.text.replace(/#[\w\u4e00-\u9fff]+/g, '').trim();
      const hashtagString = hashtags.join(' ');
      formatted.text = `${textWithoutHashtags} ${hashtagString}`.trim();
    }
    
    // Generate alt text if not provided and image is available
    if (!formatted.altText && formatted.imageUrl && formatted.text) {
      formatted.altText = formatted.text.substring(0, 500); // Max 500 characters for alt text
    }
    
    // Suggest dominant color extraction if not provided
    if (!formatted.dominantColor && formatted.imageUrl) {
      // In a real implementation, you might use an image processing service
      // to extract the dominant color from the image
      formatted.dominantColor = '#E60023'; // Pinterest red as fallback
    }
    
    return formatted;
  }
}
