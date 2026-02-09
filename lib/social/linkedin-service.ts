/**
 * LinkedIn Platform Service
 *
 * @description LinkedIn API integration for syncing analytics, posts, and profiles
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - LINKEDIN_CLIENT_ID: LinkedIn app client ID (SECRET)
 * - LINKEDIN_CLIENT_SECRET: LinkedIn app client secret (SECRET)
 *
 * User credentials are stored per-user in the database (PlatformConnection)
 *
 * FAILURE MODE: Service will return error results, never throws for sync operations
 */

import {
  BasePlatformService,
  PlatformCredentials,
  SyncAnalyticsResult,
  SyncPostsResult,
  SyncProfileResult,
  PostContent,
  PostResult,
  PlatformError,
} from './base-platform-service';
import { logger } from '@/lib/logger';

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';
const LINKEDIN_API_REST = 'https://api.linkedin.com/rest';

export class LinkedInService extends BasePlatformService {
  readonly platform = 'linkedin';

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    useRestApi: boolean = false
  ): Promise<T> {
    if (!this.credentials?.accessToken) {
      throw new PlatformError('linkedin', 'No access token configured');
    }

    const baseUrl = useRestApi ? LINKEDIN_API_REST : LINKEDIN_API_BASE;
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.credentials.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202401',
      ...(options.headers as Record<string, string> || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Update rate limits
      const rateLimitHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        if (key.toLowerCase().startsWith('x-li-')) {
          rateLimitHeaders[key] = value;
        }
      });
      this.updateRateLimits(endpoint, rateLimitHeaders);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new PlatformError(
          'linkedin',
          `API request failed: ${response.status} - ${errorBody}`,
          response.status
        );
      }

      return await response.json();
    } catch (error: any) {
      if (error instanceof PlatformError) throw error;
      throw new PlatformError('linkedin', error.message, undefined, error);
    }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      await this.makeRequest('/me');
      return true;
    } catch (error) {
      logger.error('LinkedIn credentials validation failed', { error });
      return false;
    }
  }

  async refreshToken(): Promise<PlatformCredentials> {
    if (!this.credentials?.refreshToken) {
      throw new PlatformError('linkedin', 'No refresh token available');
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new PlatformError('linkedin', 'LinkedIn OAuth credentials not configured');
    }

    try {
      const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.credentials.refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!response.ok) {
        throw new PlatformError('linkedin', 'Token refresh failed', response.status);
      }

      const data = await response.json();

      const newCredentials: PlatformCredentials = {
        ...this.credentials,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || this.credentials.refreshToken,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };

      this.credentials = newCredentials;
      return newCredentials;
    } catch (error: any) {
      throw new PlatformError('linkedin', `Token refresh failed: ${error.message}`);
    }
  }

  async syncAnalytics(days: number = 30): Promise<SyncAnalyticsResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          metrics: { impressions: 0, engagements: 0, followers: 0 },
          period: { start: new Date(), end: new Date() },
          error: 'Service not configured',
        };
      }

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      // Get profile for person URN
      const profile = await this.makeRequest<any>('/me');
      const personUrn = `urn:li:person:${profile.id}`;

      // Get follower statistics
      let followers = 0;
      try {
        const networkInfo = await this.makeRequest<any>(
          `/networkSizes/${encodeURIComponent(personUrn)}?edgeType=CompanyFollowedByMember`
        );
        followers = networkInfo.firstDegreeSize || 0;
      } catch {
        // Fallback - connections count
        const connections = await this.makeRequest<any>('/connections?q=viewer&count=0');
        followers = connections._total || 0;
      }

      // Get share statistics (posts analytics)
      let impressions = 0;
      let engagements = 0;
      const dailyBreakdown: Array<{ date: string; impressions: number; engagements: number }> = [];

      try {
        // Get recent shares/posts
        const shares = await this.makeRequest<any>(
          `/shares?q=owners&owners=${encodeURIComponent(personUrn)}&count=50`
        );

        // Aggregate metrics from posts
        if (shares.elements) {
          for (const share of shares.elements) {
            try {
              const stats = await this.makeRequest<any>(
                `/socialActions/${encodeURIComponent(share.activity)}/statistics`
              );
              impressions += stats.impressionCount || 0;
              engagements += (stats.likeCount || 0) + (stats.commentCount || 0) + (stats.shareCount || 0);
            } catch {
              // Skip posts without accessible stats
            }
          }
        }
      } catch (error) {
        logger.warn('Failed to fetch LinkedIn share statistics', { error });
      }

      return {
        success: true,
        metrics: {
          impressions,
          engagements,
          followers,
          following: 0,
          posts: 0,
          likes: 0,
          comments: 0,
          shares: 0,
        },
        period: {
          start: startDate,
          end: endDate,
        },
        breakdown: {
          daily: dailyBreakdown,
        },
      };
    } catch (error: any) {
      logger.error('LinkedIn analytics sync failed', { error });
      return {
        success: false,
        metrics: { impressions: 0, engagements: 0, followers: 0 },
        period: { start: new Date(), end: new Date() },
        error: error.message,
      };
    }
  }

  async syncPosts(limit: number = 20, cursor?: string): Promise<SyncPostsResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          posts: [],
          total: 0,
          hasMore: false,
          error: 'Service not configured',
        };
      }

      // Get profile for person URN
      const profile = await this.makeRequest<any>('/me');
      const personUrn = `urn:li:person:${profile.id}`;

      // Build query with pagination
      let endpoint = `/shares?q=owners&owners=${encodeURIComponent(personUrn)}&count=${limit}`;
      if (cursor) {
        endpoint += `&start=${cursor}`;
      }

      const response = await this.makeRequest<any>(endpoint);

      const posts = await Promise.all(
        (response.elements || []).map(async (share: any) => {
          // Get engagement stats for each post
          let likes = 0, comments = 0, shares = 0, impressions = 0;

          try {
            const stats = await this.makeRequest<any>(
              `/socialActions/${encodeURIComponent(share.activity)}/statistics`
            );
            likes = stats.likeCount || 0;
            comments = stats.commentCount || 0;
            shares = stats.shareCount || 0;
            impressions = stats.impressionCount || 0;
          } catch {
            // Stats not available
          }

          return {
            id: share.id,
            platformId: share.activity,
            content: share.text?.text || share.commentary || '',
            mediaUrls: share.content?.contentEntities?.map((e: any) => e.entityLocation) || [],
            publishedAt: new Date(share.created?.time || share.lastModified?.time),
            metrics: {
              likes,
              comments,
              shares,
              impressions,
            },
            url: `https://www.linkedin.com/feed/update/${share.activity}`,
          };
        })
      );

      const nextCursor = response.paging?.start !== undefined
        ? String(response.paging.start + response.paging.count)
        : undefined;

      return {
        success: true,
        posts,
        total: response.paging?.total || posts.length,
        hasMore: !!nextCursor && posts.length === limit,
        cursor: nextCursor,
      };
    } catch (error: any) {
      logger.error('LinkedIn posts sync failed', { error });
      return {
        success: false,
        posts: [],
        total: 0,
        hasMore: false,
        error: error.message,
      };
    }
  }

  async syncProfile(): Promise<SyncProfileResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          profile: {
            id: '',
            username: '',
            displayName: '',
            followers: 0,
            following: 0,
            postsCount: 0,
          },
          error: 'Service not configured',
        };
      }

      // Get basic profile
      const profile = await this.makeRequest<any>(
        '/me?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams),vanityName)'
      );

      // Get email if available
      let email = '';
      try {
        const emailResponse = await this.makeRequest<any>(
          '/emailAddress?q=members&projection=(elements*(handle~))'
        );
        email = emailResponse.elements?.[0]?.['handle~']?.emailAddress || '';
      } catch {
        // Email not accessible
      }

      // Get network size
      let followers = 0;
      try {
        const personUrn = `urn:li:person:${profile.id}`;
        const networkInfo = await this.makeRequest<any>(
          `/networkSizes/${encodeURIComponent(personUrn)}?edgeType=CompanyFollowedByMember`
        );
        followers = networkInfo.firstDegreeSize || 0;
      } catch {
        // Fallback to connections
        try {
          const connections = await this.makeRequest<any>('/connections?q=viewer&count=0');
          followers = connections._total || 0;
        } catch {
          // No connection count available
        }
      }

      // Extract profile picture URL
      let avatarUrl = '';
      if (profile.profilePicture?.['displayImage~']?.elements) {
        const images = profile.profilePicture['displayImage~'].elements;
        const largestImage = images.sort((a: any, b: any) =>
          (b.data?.['com.linkedin.digitalmedia.mediaartifact.StillImage']?.storageSize?.width || 0) -
          (a.data?.['com.linkedin.digitalmedia.mediaartifact.StillImage']?.storageSize?.width || 0)
        )[0];
        avatarUrl = largestImage?.identifiers?.[0]?.identifier || '';
      }

      // Get first and last name
      const firstName = profile.firstName?.localized?.[Object.keys(profile.firstName?.localized || {})[0]] || '';
      const lastName = profile.lastName?.localized?.[Object.keys(profile.lastName?.localized || {})[0]] || '';

      return {
        success: true,
        profile: {
          id: profile.id,
          username: profile.vanityName || profile.id,
          displayName: `${firstName} ${lastName}`.trim(),
          bio: '', // LinkedIn doesn't expose bio in basic API
          avatarUrl,
          followers,
          following: 0, // LinkedIn doesn't expose following count
          postsCount: 0, // Would need separate query
          verified: false,
          url: `https://www.linkedin.com/in/${profile.vanityName || profile.id}`,
        },
      };
    } catch (error: any) {
      logger.error('LinkedIn profile sync failed', { error });
      return {
        success: false,
        profile: {
          id: '',
          username: '',
          displayName: '',
          followers: 0,
          following: 0,
          postsCount: 0,
        },
        error: error.message,
      };
    }
  }

  async createPost(content: PostContent): Promise<PostResult> {
    try {
      if (!this.isConfigured()) {
        return { success: false, error: 'Service not configured' };
      }

      // Get author URN
      const profile = await this.makeRequest<any>('/me');
      const authorUrn = `urn:li:person:${profile.id}`;

      // Build post payload
      const postPayload: any = {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content.text,
            },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility':
            content.visibility === 'connections' ? 'CONNECTIONS' : 'PUBLIC',
        },
      };

      // Add link if provided
      if (content.linkUrl) {
        postPayload.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'ARTICLE';
        postPayload.specificContent['com.linkedin.ugc.ShareContent'].media = [{
          status: 'READY',
          originalUrl: content.linkUrl,
        }];
      }

      // Create the post
      const response = await this.makeRequest<any>('/ugcPosts', {
        method: 'POST',
        body: JSON.stringify(postPayload),
      });

      return {
        success: true,
        postId: response.id,
        url: `https://www.linkedin.com/feed/update/${response.id}`,
      };
    } catch (error: any) {
      logger.error('LinkedIn post creation failed', { error });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async deletePost(postId: string): Promise<boolean> {
    try {
      if (!this.isConfigured()) {
        return false;
      }

      await this.makeRequest(`/ugcPosts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
      });

      return true;
    } catch (error: any) {
      logger.error('LinkedIn post deletion failed', { error, postId });
      return false;
    }
  }

  async getPostMetrics(postId: string): Promise<any> {
    try {
      if (!this.isConfigured()) {
        return null;
      }

      const stats = await this.makeRequest<any>(
        `/socialActions/${encodeURIComponent(postId)}/statistics`
      );

      return {
        likes: stats.likeCount || 0,
        comments: stats.commentCount || 0,
        shares: stats.shareCount || 0,
        impressions: stats.impressionCount || 0,
        clicks: stats.clickCount || 0,
      };
    } catch (error: any) {
      logger.error('LinkedIn post metrics fetch failed', { error, postId });
      return null;
    }
  }
}

// Export singleton instance
export const linkedInService = new LinkedInService();
