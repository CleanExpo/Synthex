import { z } from 'zod';

// Base schemas for platform posts
export const BasePlatformPostSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  mediaUrls: z.array(z.string().url()).optional(),
  scheduledAt: z.date().optional(),
});

export const PlatformAnalyticsSchema = z.object({
  postId: z.string(),
  platformPostId: z.string().optional(),
  views: z.number().default(0),
  likes: z.number().default(0),
  shares: z.number().default(0),
  comments: z.number().default(0),
  clicks: z.number().default(0),
  impressions: z.number().default(0),
  reach: z.number().default(0),
  engagementRate: z.number().default(0),
  updatedAt: z.date().default(() => new Date()),
});

export type BasePlatformPost = z.infer<typeof BasePlatformPostSchema>;
export type PlatformAnalytics = z.infer<typeof PlatformAnalyticsSchema>;

// Platform connection configuration
export interface PlatformConfig {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  accountId?: string;
  pageId?: string;
  [key: string]: any;
}

// Platform post response
export interface PlatformPostResponse {
  success: boolean;
  platformPostId?: string;
  url?: string;
  error?: string;
  scheduledFor?: Date;
}

// Platform analytics response
export interface PlatformAnalyticsResponse {
  success: boolean;
  analytics?: PlatformAnalytics;
  error?: string;
}

// Base platform service interface
export abstract class BasePlatformService {
  protected config: PlatformConfig;
  protected platformName: string;

  constructor(platformName: string, config: PlatformConfig) {
    this.platformName = platformName;
    this.config = config;
  }

  // Abstract methods that each platform must implement
  abstract validateConfig(): Promise<boolean>;
  abstract publishPost(post: BasePlatformPost): Promise<PlatformPostResponse>;
  abstract schedulePost(post: BasePlatformPost): Promise<PlatformPostResponse>;
  abstract deletePost(platformPostId: string): Promise<boolean>;
  abstract getAnalytics(platformPostId: string): Promise<PlatformAnalyticsResponse>;
  abstract testConnection(): Promise<boolean>;

  // Common utility methods
  protected validateMediaUrls(urls: string[] = []): boolean {
    return urls.every(url => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });
  }

  protected truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength - 3) + '...';
  }

  protected formatHashtags(content: string): string {
    // Extract hashtags and format them properly for each platform
    return content.replace(/#([a-zA-Z0-9_]+)/g, '#$1');
  }

  protected extractUrls(content: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.match(urlRegex) || [];
  }

  // Rate limiting helper
  protected async rateLimit(lastRequestTime: Date, minInterval: number): Promise<void> {
    const now = new Date();
    const timeSinceLastRequest = now.getTime() - lastRequestTime.getTime();
    
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // Error handling helper
  protected handleApiError(error: any, operation: string): PlatformPostResponse | PlatformAnalyticsResponse {
    console.error(`${this.platformName} ${operation} error:`, error);
    
    let errorMessage = `Failed to ${operation}`;
    
    if (error.response?.data?.error) {
      errorMessage += `: ${error.response.data.error}`;
    } else if (error.message) {
      errorMessage += `: ${error.message}`;
    }

    return {
      success: false,
      error: errorMessage
    };
  }

  // Common validation for required config
  protected validateRequiredConfig(requiredFields: string[]): boolean {
    return requiredFields.every(field => {
      const value = this.config[field];
      return value && value.trim().length > 0;
    });
  }
}

// Platform factory interface
export interface PlatformFactory {
  createPlatform(platformName: string, config: PlatformConfig): BasePlatformService | null;
  getSupportedPlatforms(): string[];
}

// Supported platforms enum
export enum SupportedPlatforms {
  TWITTER = 'twitter',
  INSTAGRAM = 'instagram', 
  LINKEDIN = 'linkedin',
  FACEBOOK = 'facebook',
  TIKTOK = 'tiktok'
}

// Platform limits configuration
export const PLATFORM_LIMITS = {
  [SupportedPlatforms.TWITTER]: {
    textLimit: 280,
    mediaLimit: 4,
    videoLimit: 1,
    rateLimitPerHour: 300
  },
  [SupportedPlatforms.INSTAGRAM]: {
    textLimit: 2200,
    mediaLimit: 10,
    videoLimit: 1,
    rateLimitPerHour: 200
  },
  [SupportedPlatforms.LINKEDIN]: {
    textLimit: 3000,
    mediaLimit: 9,
    videoLimit: 1,
    rateLimitPerHour: 100
  },
  [SupportedPlatforms.FACEBOOK]: {
    textLimit: 63206,
    mediaLimit: 10,
    videoLimit: 1,
    rateLimitPerHour: 200
  },
  [SupportedPlatforms.TIKTOK]: {
    textLimit: 2200,
    mediaLimit: 0,
    videoLimit: 1,
    rateLimitPerHour: 50
  }
} as const;

export default BasePlatformService;
