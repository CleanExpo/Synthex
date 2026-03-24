/**
 * SYNTHEX YouTube Uploader Service
 *
 * Uploads videos to YouTube Data API v3 using native fetch (no googleapis dep).
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - YOUTUBE_CLIENT_ID: OAuth client ID
 * - YOUTUBE_CLIENT_SECRET: OAuth client secret
 * - YOUTUBE_REFRESH_TOKEN: OAuth refresh token
 */

import * as fs from 'fs';
import { logger } from '@/lib/logger';

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

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YT_UPLOAD_URL =
  'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
const YT_API_URL = 'https://www.googleapis.com/youtube/v3';

export class YouTubeUploader {
  private _configured: boolean;
  private _credentials: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
  };

  constructor(credentials?: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }) {
    const clientId = credentials?.clientId ?? process.env.YOUTUBE_CLIENT_ID;
    const clientSecret =
      credentials?.clientSecret ?? process.env.YOUTUBE_CLIENT_SECRET;
    const refreshToken =
      credentials?.refreshToken ?? process.env.YOUTUBE_REFRESH_TOKEN;

    if (!clientId || !clientSecret) {
      console.warn('[YouTubeUploader] Missing YouTube API credentials');
    }

    this._configured = !!(clientId && clientSecret && refreshToken);
    this._credentials = { clientId, clientSecret, refreshToken };
  }

  static fromCredentials(
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ): YouTubeUploader {
    return new YouTubeUploader({ clientId, clientSecret, refreshToken });
  }

  isConfigured(): boolean {
    return this._configured;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this._credentials.clientId!,
        client_secret: this._credentials.clientSecret!,
        refresh_token: this._credentials.refreshToken!,
        grant_type: 'refresh_token',
      }).toString(),
    });
    const data = (await res.json()) as {
      access_token?: string;
      error?: string;
    };
    if (!data.access_token) {
      throw new Error(
        `Failed to get access token: ${data.error ?? JSON.stringify(data)}`
      );
    }
    return data.access_token;
  }

  private async apiGet(path: string, token: string): Promise<unknown> {
    const res = await fetch(`${YT_API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  }

  private async apiPost(
    path: string,
    body: unknown,
    token: string
  ): Promise<unknown> {
    const res = await fetch(`${YT_API_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  // ── Public methods ─────────────────────────────────────────────────────────

  async uploadVideo(
    videoPath: string,
    metadata: VideoMetadata
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new Error(
        'YouTube API not configured. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN'
      );
    }
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const token = await this.getAccessToken();

    const fileSize = fs.statSync(videoPath).size;
    logger.info('YouTubeUploader starting upload', {
      videoPath,
      title: metadata.title,
      fileSizeMB: (fileSize / 1024 / 1024).toFixed(2),
    });

    // Step 1: Initiate resumable upload — get upload URL
    const initRes = await fetch(YT_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/*',
        'X-Upload-Content-Length': String(fileSize),
      },
      body: JSON.stringify({
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
      }),
    });

    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) {
      const errText = await initRes.text();
      throw new Error(`Failed to initiate upload: ${errText}`);
    }

    // Step 2: Upload the file (single PUT for small files < 256 MB)
    const videoBuffer = fs.readFileSync(videoPath);
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/*',
        'Content-Length': String(fileSize),
      },
      body: videoBuffer,
    });

    const result = (await uploadRes.json()) as { id?: string; error?: unknown };
    if (!result.id) {
      throw new Error(
        `Upload failed — no video ID returned: ${JSON.stringify(result)}`
      );
    }

    const videoId = result.id;
    logger.info('YouTubeUploader upload complete', { videoId });

    // Upload thumbnail if provided (non-fatal)
    if (metadata.thumbnailPath && fs.existsSync(metadata.thumbnailPath)) {
      try {
        await this.uploadThumbnail(videoId, metadata.thumbnailPath);
      } catch (thumbErr) {
        logger.warn('YouTubeUploader thumbnail upload skipped', {
          videoId,
          reason:
            thumbErr instanceof Error ? thumbErr.message : String(thumbErr),
        });
      }
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

  async uploadThumbnail(videoId: string, thumbnailPath: string): Promise<void> {
    const token = await this.getAccessToken();
    logger.info('YouTubeUploader uploading thumbnail', { videoId });
    const buffer = fs.readFileSync(thumbnailPath);
    await fetch(
      `${YT_API_URL}/thumbnails/set?videoId=${encodeURIComponent(videoId)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'image/jpeg',
        },
        body: buffer,
      }
    );
    logger.info('YouTubeUploader thumbnail uploaded');
  }

  async addToPlaylist(videoId: string, playlistId: string): Promise<void> {
    const token = await this.getAccessToken();
    logger.info('YouTubeUploader adding to playlist', { videoId, playlistId });
    await this.apiPost(
      '/playlistItems?part=snippet',
      {
        snippet: {
          playlistId,
          resourceId: { kind: 'youtube#video', videoId },
        },
      },
      token
    );
    logger.info('YouTubeUploader added to playlist');
  }

  async createPlaylist(
    title: string,
    description: string,
    privacyStatus: 'public' | 'private' | 'unlisted' = 'public'
  ): Promise<string> {
    const token = await this.getAccessToken();
    logger.info('YouTubeUploader creating playlist', { title });
    const data = (await this.apiPost(
      '/playlists?part=snippet,status',
      {
        snippet: { title, description },
        status: { privacyStatus },
      },
      token
    )) as { id?: string };
    if (!data.id) throw new Error('Failed to create playlist');
    logger.info('YouTubeUploader playlist created', { playlistId: data.id });
    return data.id;
  }

  async updateVideo(
    videoId: string,
    metadata: Partial<VideoMetadata>
  ): Promise<void> {
    const token = await this.getAccessToken();
    logger.info('YouTubeUploader updating video', { videoId });
    await this.apiPost(
      '/videos?part=snippet,status',
      {
        id: videoId,
        snippet: {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          categoryId: metadata.categoryId,
        },
        status: metadata.privacyStatus
          ? { privacyStatus: metadata.privacyStatus }
          : undefined,
      },
      token
    );
    logger.info('YouTubeUploader video updated');
  }

  async getVideo(videoId: string) {
    const token = await this.getAccessToken();
    return this.apiGet(
      `/videos?part=snippet,statistics,status&id=${encodeURIComponent(videoId)}`,
      token
    );
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

Analyse patterns: https://synthex.social
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
