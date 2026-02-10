/**
 * SYNTHEX YouTube Uploader Service
 *
 * Uploads videos to YouTube Data API v3 with SEO metadata.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - YOUTUBE_CLIENT_ID: OAuth client ID
 * - YOUTUBE_CLIENT_SECRET: OAuth client secret
 * - YOUTUBE_REFRESH_TOKEN: OAuth refresh token
 */

import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

export interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: 'public' | 'private' | 'unlisted';
  playlistId?: string;
  thumbnailPath?: string;
}

export interface UploadResult {
  videoId: string;
  videoUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
}

// YouTube category IDs
export const YOUTUBE_CATEGORIES = {
  FILM_ANIMATION: '1',
  AUTOS_VEHICLES: '2',
  MUSIC: '10',
  PETS_ANIMALS: '15',
  SPORTS: '17',
  TRAVEL_EVENTS: '19',
  GAMING: '20',
  PEOPLE_BLOGS: '22',
  COMEDY: '23',
  ENTERTAINMENT: '24',
  NEWS_POLITICS: '25',
  HOWTO_STYLE: '26',
  EDUCATION: '27',
  SCIENCE_TECH: '28',
  NONPROFITS_ACTIVISM: '29',
};

export class YouTubeUploader {
  private oauth2Client: InstanceType<typeof google.auth.OAuth2>;
  private youtube: ReturnType<typeof google.youtube>;

  constructor() {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

    if (!clientId || !clientSecret) {
      console.warn('[YouTubeUploader] Missing YouTube API credentials');
    }

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret);

    if (refreshToken) {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });
    }

    this.youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    });
  }

  /**
   * Check if credentials are configured
   */
  isConfigured(): boolean {
    return !!(
      process.env.YOUTUBE_CLIENT_ID &&
      process.env.YOUTUBE_CLIENT_SECRET &&
      process.env.YOUTUBE_REFRESH_TOKEN
    );
  }

  /**
   * Upload video to YouTube
   */
  async uploadVideo(videoPath: string, metadata: VideoMetadata): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new Error(
        'YouTube API not configured. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN'
      );
    }

    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    console.log(`[YouTubeUploader] Uploading: ${videoPath}`);
    console.log(`[YouTubeUploader] Title: ${metadata.title}`);

    const fileSize = fs.statSync(videoPath).size;
    console.log(`[YouTubeUploader] File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    const response = await this.youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          categoryId: metadata.categoryId || YOUTUBE_CATEGORIES.SCIENCE_TECH,
        },
        status: {
          privacyStatus: metadata.privacyStatus,
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: fs.createReadStream(videoPath),
      },
    });

    const videoId = response.data.id;
    if (!videoId) {
      throw new Error('Upload failed - no video ID returned');
    }

    console.log(`[YouTubeUploader] Upload complete! Video ID: ${videoId}`);

    // Upload thumbnail if provided
    if (metadata.thumbnailPath && fs.existsSync(metadata.thumbnailPath)) {
      await this.uploadThumbnail(videoId, metadata.thumbnailPath);
    }

    // Add to playlist if specified
    if (metadata.playlistId) {
      await this.addToPlaylist(videoId, metadata.playlistId);
    }

    return {
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    };
  }

  /**
   * Upload custom thumbnail
   */
  async uploadThumbnail(videoId: string, thumbnailPath: string): Promise<void> {
    console.log(`[YouTubeUploader] Uploading thumbnail for video: ${videoId}`);

    await this.youtube.thumbnails.set({
      videoId,
      media: {
        body: fs.createReadStream(thumbnailPath),
      },
    });

    console.log('[YouTubeUploader] Thumbnail uploaded');
  }

  /**
   * Add video to playlist
   */
  async addToPlaylist(videoId: string, playlistId: string): Promise<void> {
    console.log(`[YouTubeUploader] Adding video ${videoId} to playlist ${playlistId}`);

    await this.youtube.playlistItems.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          playlistId,
          resourceId: {
            kind: 'youtube#video',
            videoId,
          },
        },
      },
    });

    console.log('[YouTubeUploader] Added to playlist');
  }

  /**
   * Create a new playlist
   */
  async createPlaylist(
    title: string,
    description: string,
    privacyStatus: 'public' | 'private' | 'unlisted' = 'public'
  ): Promise<string> {
    console.log(`[YouTubeUploader] Creating playlist: ${title}`);

    const response = await this.youtube.playlists.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title,
          description,
        },
        status: {
          privacyStatus,
        },
      },
    });

    const playlistId = response.data.id;
    if (!playlistId) {
      throw new Error('Failed to create playlist');
    }

    console.log(`[YouTubeUploader] Playlist created: ${playlistId}`);
    return playlistId;
  }

  /**
   * Update video metadata
   */
  async updateVideo(videoId: string, metadata: Partial<VideoMetadata>): Promise<void> {
    console.log(`[YouTubeUploader] Updating video: ${videoId}`);

    await this.youtube.videos.update({
      part: ['snippet', 'status'],
      requestBody: {
        id: videoId,
        snippet: {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          categoryId: metadata.categoryId,
        },
        status: metadata.privacyStatus
          ? {
              privacyStatus: metadata.privacyStatus,
            }
          : undefined,
      },
    });

    console.log('[YouTubeUploader] Video updated');
  }

  /**
   * Get video details
   */
  async getVideo(videoId: string) {
    return this.youtube.videos.list({
      part: ['snippet', 'statistics', 'status'],
      id: [videoId],
    });
  }
}

// Pre-defined metadata templates for Synthex videos
export const SYNTHEX_VIDEO_METADATA: Record<string, Partial<VideoMetadata>> = {
  platformOverview: {
    title: 'Synthex Platform Overview - AI Marketing Automation',
    description: `Welcome to Synthex - The world's first fully autonomous AI marketing agency.

In this video, you'll see:
• Dashboard overview with real-time stats
• AI-powered content generation
• Smart scheduling system
• Analytics and insights
• Viral pattern analysis

Start your free trial: https://synthex.social
Subscribe for more AI marketing tips!

#AIMarketing #MarketingAutomation #SocialMediaMarketing #Synthex`,
    tags: [
      'AI marketing',
      'marketing automation',
      'social media marketing',
      'content generation',
      'Synthex',
      'AI agency',
      'autonomous marketing',
    ],
    categoryId: YOUTUBE_CATEGORIES.SCIENCE_TECH,
    privacyStatus: 'public',
  },

  contentGenerator: {
    title: 'AI Content Generator Tutorial - Synthex',
    description: `Learn how to create viral social media content in seconds with Synthex's AI Content Generator.

Features shown:
• Platform-specific content optimization
• Multiple tone and style options
• Hook type selection
• Real-time AI generation
• Content variations

Try it free: https://synthex.social
#AIContent #ContentCreation #SocialMedia`,
    tags: [
      'AI content',
      'content generator',
      'social media content',
      'AI writing',
      'Synthex tutorial',
    ],
    categoryId: YOUTUBE_CATEGORIES.HOWTO_STYLE,
    privacyStatus: 'public',
  },

  analyticsDashboard: {
    title: 'Social Media Analytics Dashboard - Synthex',
    description: `Discover powerful analytics insights with Synthex's real-time dashboard.

What you'll learn:
• Engagement metrics tracking
• Cross-platform performance
• Trend analysis
• Export and reporting
• Data-driven optimization

Get started: https://synthex.social
#Analytics #SocialMediaAnalytics #DataDriven`,
    tags: [
      'social media analytics',
      'marketing analytics',
      'engagement metrics',
      'data analytics',
      'Synthex',
    ],
    categoryId: YOUTUBE_CATEGORIES.SCIENCE_TECH,
    privacyStatus: 'public',
  },

  smartScheduler: {
    title: 'Smart Content Scheduler - Optimal Posting Times | Synthex',
    description: `Master social media scheduling with Synthex's AI-powered Smart Scheduler.

Features covered:
• Week, month, and list views
• Drag-and-drop scheduling
• Optimal posting time recommendations
• Multi-platform publishing
• Queue management

Schedule smarter: https://synthex.social
#ContentScheduling #SocialMediaScheduler #MarketingTools`,
    tags: [
      'content scheduling',
      'social media scheduler',
      'optimal posting times',
      'marketing calendar',
      'Synthex',
    ],
    categoryId: YOUTUBE_CATEGORIES.HOWTO_STYLE,
    privacyStatus: 'public',
  },

  viralPatterns: {
    title: 'Viral Pattern Analysis - Discover What Works | Synthex',
    description: `Uncover the secrets of viral content with Synthex's Viral Pattern Analyzer.

Learn about:
• Pattern detection algorithms
• Hook type analysis
• Engagement prediction
• Trend identification
• Competitive insights

Analyze patterns: https://synthex.social
#ViralContent #ContentStrategy #MarketingInsights`,
    tags: [
      'viral content',
      'pattern analysis',
      'content strategy',
      'engagement',
      'marketing insights',
      'Synthex',
    ],
    categoryId: YOUTUBE_CATEGORIES.SCIENCE_TECH,
    privacyStatus: 'public',
  },
};

export default YouTubeUploader;
