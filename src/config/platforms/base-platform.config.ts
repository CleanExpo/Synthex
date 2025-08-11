export interface PlatformConfig {
  name: string;
  displayName: string;
  icon: string;
  color: string;
  oauth: {
    authorizationUrl: string;
    tokenUrl: string;
    scopes: string[];
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
  };
  api: {
    baseUrl: string;
    version: string;
    endpoints: {
      profile: string;
      posts: string;
      publish: string;
      media?: string;
      analytics?: string;
      comments?: string;
    };
    rateLimit: {
      requests: number;
      window: number; // in milliseconds
    };
  };
  content: {
    maxLength: number;
    maxImages: number;
    maxVideos: number;
    imageFormats: string[];
    videoFormats: string[];
    maxImageSize: number; // in MB
    maxVideoSize: number; // in MB
    maxVideoDuration: number; // in seconds
    features: {
      hashtags: boolean;
      mentions: boolean;
      links: boolean;
      stories: boolean;
      reels: boolean;
      polls: boolean;
      threads: boolean;
    };
  };
  analytics: {
    metrics: string[];
    refreshInterval: number; // in milliseconds
  };
}

export abstract class BasePlatformService {
  protected config: PlatformConfig;
  
  constructor(config: PlatformConfig) {
    this.config = config;
  }
  
  abstract authenticate(code: string): Promise<any>;
  abstract refreshToken(refreshToken: string): Promise<any>;
  abstract getProfile(accessToken: string): Promise<any>;
  abstract publishPost(accessToken: string, content: any): Promise<any>;
  abstract getAnalytics(accessToken: string, postId: string): Promise<any>;
  abstract deletePost(accessToken: string, postId: string): Promise<boolean>;
  abstract schedulePost(accessToken: string, content: any, scheduledTime: Date): Promise<any>;
  
  // Common helper methods
  protected async makeApiRequest(
    endpoint: string,
    accessToken: string,
    method: string = 'GET',
    body?: any
  ): Promise<any> {
    const url = `${this.config.api.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`${this.config.name} API error: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  validateContent(content: any): boolean {
    if (content.text && content.text.length > this.config.content.maxLength) {
      throw new Error(`Content exceeds maximum length of ${this.config.content.maxLength} characters`);
    }
    
    if (content.images && content.images.length > this.config.content.maxImages) {
      throw new Error(`Too many images. Maximum allowed: ${this.config.content.maxImages}`);
    }
    
    if (content.videos && content.videos.length > this.config.content.maxVideos) {
      throw new Error(`Too many videos. Maximum allowed: ${this.config.content.maxVideos}`);
    }
    
    return true;
  }
  
  formatContent(content: any): any {
    // Platform-specific content formatting
    return content;
  }
}