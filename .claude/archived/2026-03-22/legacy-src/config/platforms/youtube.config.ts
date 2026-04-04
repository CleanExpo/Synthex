import { PlatformConfig, BasePlatformService } from './base-platform.config';

export const youtubeConfig: PlatformConfig = {
  name: 'youtube',
  displayName: 'YouTube',
  icon: 'youtube',
  color: '#FF0000',
  oauth: {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtubepartner',
      'https://www.googleapis.com/auth/youtube.channel-memberships.creator',
    ],
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    redirectUri: process.env.YOUTUBE_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/callback/youtube`,
  },
  api: {
    baseUrl: 'https://www.googleapis.com/youtube/v3',
    version: 'v3',
    endpoints: {
      profile: '/channels',
      posts: '/videos',
      publish: '/videos',
      media: '/videos',
      analytics: '/reports',
      comments: '/commentThreads',
    },
    rateLimit: {
      requests: 10000,
      window: 86400000, // 24 hours
    },
  },
  content: {
    maxLength: 5000, // YouTube description limit
    maxImages: 1, // Thumbnail
    maxVideos: 1,
    imageFormats: ['jpg', 'jpeg', 'png', 'gif', 'bmp'],
    videoFormats: ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', 'mkv'],
    maxImageSize: 2, // 2MB for thumbnails
    maxVideoSize: 256000, // 256GB for premium accounts
    maxVideoDuration: 43200, // 12 hours for verified accounts
    features: {
      hashtags: true,
      mentions: false, // No direct mentions in descriptions
      links: true,
      stories: true, // YouTube Shorts
      reels: true, // YouTube Shorts
      polls: true, // Community posts
      threads: false,
    },
  },
  analytics: {
    metrics: [
      'views',
      'likes',
      'dislikes',
      'comments',
      'shares',
      'subscribersGained',
      'subscribersLost',
      'estimatedWatchTime',
      'averageViewDuration',
      'impressions',
      'impressionClickThroughRate',
      'estimatedRevenue',
    ],
    refreshInterval: 3600000, // 1 hour
  },
};

export class YouTubeService extends BasePlatformService {
  constructor() {
    super(youtubeConfig);
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
      throw new Error(`YouTube OAuth error: ${data.error_description || data.error}`);
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
      throw new Error(`YouTube token refresh error: ${data.error_description || data.error}`);
    }
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Keep old refresh token if not provided
      expiresIn: data.expires_in,
    };
  }
  
  async getProfile(accessToken: string): Promise<any> {
    const params = new URLSearchParams({
      part: 'snippet,statistics,contentDetails,brandingSettings',
      mine: 'true',
    });
    
    return this.makeApiRequest(`${this.config.api.endpoints.profile}?${params}`, accessToken);
  }
  
  async publishPost(accessToken: string, content: any): Promise<any> {
    this.validateContent(content);
    
    if (!content.videoFile) {
      throw new Error('YouTube requires a video file for publishing');
    }
    
    return this.uploadVideo(accessToken, content);
  }
  
  async uploadVideo(accessToken: string, content: any): Promise<any> {
    // Step 1: Create video metadata
    const videoMetadata = {
      snippet: {
        title: content.title || 'Untitled Video',
        description: content.text || '',
        tags: content.tags || [],
        categoryId: content.categoryId || '22', // People & Blogs
        defaultLanguage: content.language || 'en',
        defaultAudioLanguage: content.audioLanguage || 'en',
      },
      status: {
        privacyStatus: content.privacy || 'private', // private, unlisted, public
        madeForKids: content.madeForKids || false,
        selfDeclaredMadeForKids: content.madeForKids || false,
      },
      recordingDetails: {
        recordingDate: content.recordingDate || new Date().toISOString(),
      },
    };
    
    // Note: Thumbnails are uploaded separately after video creation, not during initial upload
    // The thumbnail upload would be handled in a separate API call after video is created
    
    // Step 2: Upload video using resumable upload
    const uploadResponse = await this.initiateResumableUpload(accessToken, videoMetadata, content.videoFile);
    
    return {
      videoId: uploadResponse.id,
      status: uploadResponse.status,
      uploadStatus: uploadResponse.status.uploadStatus,
      publishAt: uploadResponse.status.publishAt,
    };
  }
  
  async initiateResumableUpload(accessToken: string, metadata: any, videoUrl: string): Promise<any> {
    // This is a simplified version - in practice, you'd need to handle resumable uploads
    // For large files, implement proper chunked uploading
    const params = new URLSearchParams({
      part: 'snippet,status,recordingDetails',
      uploadType: 'multipart',
    });
    
    const boundary = `----formdata-upload-${Date.now()}`;
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    
    // Create multipart body
    let body = delimiter;
    body += 'Content-Type: application/json\r\n\r\n';
    body += JSON.stringify(metadata) + delimiter;
    body += 'Content-Type: video/*\r\n\r\n';
    // In practice, you'd stream the video file here
    body += `VIDEO_FILE_PLACEHOLDER_FOR_${videoUrl}` + closeDelimiter;
    
    const response = await fetch(`${this.config.api.baseUrl}/videos?${params}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`YouTube upload error: ${error.error.message}`);
    }
    
    return response.json();
  }
  
  async getVideos(accessToken: string, maxResults: number = 25): Promise<any> {
    const params = new URLSearchParams({
      part: 'snippet,statistics,contentDetails,status',
      mine: 'true',
      maxResults: maxResults.toString(),
      order: 'date',
    });
    
    return this.makeApiRequest(`${this.config.api.endpoints.posts}?${params}`, accessToken);
  }
  
  async updateVideo(accessToken: string, videoId: string, updates: any): Promise<any> {
    const params = new URLSearchParams({
      part: 'snippet,status',
    });
    
    const updateData = {
      id: videoId,
      ...updates,
    };
    
    return this.makeApiRequest(
      `${this.config.api.endpoints.posts}?${params}`,
      accessToken,
      'PUT',
      updateData
    );
  }
  
  async getAnalytics(accessToken: string, videoId: string): Promise<any> {
    // YouTube Analytics API requires separate setup and different authentication
    // For basic analytics, use the videos endpoint with statistics
    const params = new URLSearchParams({
      part: 'statistics',
      id: videoId,
    });
    
    return this.makeApiRequest(`${this.config.api.endpoints.posts}?${params}`, accessToken);
  }
  
  async getChannelAnalytics(accessToken: string, channelId: string, startDate: string, endDate: string): Promise<any> {
    // This requires YouTube Analytics API
    const params = new URLSearchParams({
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics: this.config.analytics.metrics.join(','),
      dimensions: 'day',
    });
    
    const analyticsBaseUrl = 'https://youtubeanalytics.googleapis.com/v2';
    const response = await fetch(`${analyticsBaseUrl}/reports?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`YouTube Analytics API error: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async deletePost(accessToken: string, videoId: string): Promise<boolean> {
    const params = new URLSearchParams({ id: videoId });
    
    const response = await fetch(`${this.config.api.baseUrl}/videos?${params}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    return response.ok;
  }
  
  async schedulePost(accessToken: string, content: any, scheduledTime: Date): Promise<any> {
    const scheduledContent = {
      ...content,
      privacy: 'private', // Must be private initially
      publishAt: scheduledTime.toISOString(),
    };
    
    // Upload as private with publish time
    const uploadResult = await this.uploadVideo(accessToken, scheduledContent);
    
    // Update to set scheduled publish time
    const updateData = {
      snippet: {
        title: content.title,
        description: content.text,
      },
      status: {
        privacyStatus: content.privacy || 'public',
        publishAt: scheduledTime.toISOString(),
      },
    };
    
    return this.updateVideo(accessToken, uploadResult.videoId, updateData);
  }
  
  async createPlaylist(accessToken: string, title: string, description: string, privacy: string = 'private'): Promise<any> {
    const playlistData = {
      snippet: {
        title,
        description,
        defaultLanguage: 'en',
      },
      status: {
        privacyStatus: privacy,
      },
    };
    
    const params = new URLSearchParams({
      part: 'snippet,status',
    });
    
    return this.makeApiRequest(
      `/playlists?${params}`,
      accessToken,
      'POST',
      playlistData
    );
  }
  
  async addVideoToPlaylist(accessToken: string, playlistId: string, videoId: string): Promise<any> {
    const playlistItemData = {
      snippet: {
        playlistId,
        resourceId: {
          kind: 'youtube#video',
          videoId,
        },
      },
    };
    
    const params = new URLSearchParams({
      part: 'snippet',
    });
    
    return this.makeApiRequest(
      `/playlistItems?${params}`,
      accessToken,
      'POST',
      playlistItemData
    );
  }
  
  public formatContent(content: any): any {
    // YouTube-specific content formatting
    const formatted = { ...content };
    
    // Extract tags from description
    if (formatted.text && formatted.text.includes('#')) {
      const hashtags = formatted.text.match(/#[\w\u4e00-\u9fff]+/g) || [];
      formatted.tags = [...(formatted.tags || []), ...hashtags.map((tag: string) => tag.slice(1))];
    }
    
    // Ensure title is within limits
    if (formatted.title && formatted.title.length > 100) {
      formatted.title = formatted.title.substring(0, 97) + '...';
    }
    
    // Format description with timestamps if provided
    if (formatted.chapters && Array.isArray(formatted.chapters)) {
      const chaptersText = formatted.chapters
        .map((chapter: any) => `${chapter.timestamp} ${chapter.title}`)
        .join('\n');
      formatted.text = `${formatted.text || ''}\n\nChapters:\n${chaptersText}`;
    }
    
    return formatted;
  }
}
