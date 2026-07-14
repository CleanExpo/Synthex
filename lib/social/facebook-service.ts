/**
 * Facebook Platform Service
 *
 * @description Facebook Page publishing via the Facebook Graph API.
 * Distinct from InstagramService: it posts to a Facebook PAGE feed (text, link,
 * photo, video) using the Page access token — NOT the Instagram Business
 * account media-container flow. `createPlatformService('facebook')` previously
 * aliased to InstagramService, which rejected text-only posts and targeted an IG
 * account instead of the Page. This service fixes that.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - FACEBOOK_APP_ID: Facebook app ID (SECRET)
 * - FACEBOOK_APP_SECRET: Facebook app secret (SECRET)
 *
 * User credentials are stored per-user in the database (PlatformConnection).
 *
 * FAILURE MODE: Service returns error results, never throws for sync operations.
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
import { META_GRAPH_BASE } from './meta-graph-version';

const GRAPH_API_BASE = META_GRAPH_BASE;

/** A Facebook Page the connected user administers. */
interface PageElement {
  id: string;
  name?: string;
  access_token: string;
  fan_count?: number;
}

interface PagesResponse {
  data?: PageElement[];
}

interface FeedPublishResponse {
  id?: string;
  post_id?: string;
}

interface PageProfileResponse {
  id: string;
  name?: string;
  username?: string;
  about?: string;
  picture?: { data?: { url?: string } };
  fan_count?: number;
  link?: string;
}

interface PagePostElement {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
}

interface PagePostsResponse {
  data?: PagePostElement[];
  paging?: { cursors?: { after?: string; before?: string } };
}

interface FacebookPostMetrics {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
  engagement: number;
}

export class FacebookService extends BasePlatformService {
  readonly platform = 'facebook';
  private page: { id: string; accessToken: string } | null = null;

  /**
   * Resolve the target Facebook Page (id + page access token). Selects
   * `desiredPageId` when provided (e.g. from post content metadata), else the
   * first administered Page. Page posting REQUIRES the page-scoped token, not
   * the user token.
   */
  private async getPageCredentials(
    desiredPageId?: string
  ): Promise<{ id: string; accessToken: string }> {
    if (this.page && (!desiredPageId || this.page.id === desiredPageId)) {
      return this.page;
    }

    const pages = await this.makeRequest<PagesResponse>(
      '/me/accounts?fields=id,name,access_token,fan_count'
    );

    if (!pages.data || pages.data.length === 0) {
      throw new PlatformError(
        'facebook',
        'No Facebook Pages found. Connect a Page you administer (requires pages_manage_posts).'
      );
    }

    const chosen = desiredPageId
      ? pages.data.find((p) => p.id === desiredPageId)
      : pages.data[0];

    if (!chosen) {
      throw new PlatformError(
        'facebook',
        `Facebook Page ${desiredPageId} not found among administered Pages.`
      );
    }

    this.page = { id: chosen.id, accessToken: chosen.access_token };
    return this.page;
  }

  /**
   * Graph API request. Uses the user token by default; pass a page token for
   * page-scoped write calls.
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string
  ): Promise<T> {
    await this.ensureValidToken();

    const accessToken = token || this.credentials?.accessToken;
    if (!accessToken) {
      throw new PlatformError('facebook', 'No access token configured');
    }

    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${GRAPH_API_BASE}${endpoint}${separator}access_token=${accessToken}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new PlatformError(
          'facebook',
          data.error?.message || `API request failed: ${response.status}`,
          response.status
        );
      }
      return data as T;
    } catch (error: unknown) {
      if (error instanceof PlatformError) throw error;
      const originalError = error instanceof Error ? error : undefined;
      throw new PlatformError(
        'facebook',
        error instanceof Error ? error.message : String(error),
        undefined,
        originalError
      );
    }
  }

  protected override canRefreshToken(): boolean {
    return !!this.credentials?.accessToken;
  }

  async validateCredentials(): Promise<boolean> {
    try {
      await this.getPageCredentials();
      return true;
    } catch (error) {
      logger.error('Facebook credentials validation failed', { error });
      return false;
    }
  }

  /**
   * Exchange the current user token for a long-lived token (Meta long-lived
   * tokens last ~60 days). Mirrors InstagramService.refreshToken.
   */
  async refreshToken(): Promise<PlatformCredentials> {
    if (!this.credentials?.accessToken) {
      throw new PlatformError('facebook', 'No access token to refresh');
    }
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) {
      throw new PlatformError('facebook', 'Facebook app credentials not configured');
    }

    const response = await fetch(
      `${GRAPH_API_BASE}/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${appId}&` +
        `client_secret=${appSecret}&` +
        `fb_exchange_token=${this.credentials.accessToken}`
    );
    const data = await response.json();
    if (data.error) {
      throw new PlatformError('facebook', data.error.message || 'Facebook API error');
    }

    // Page tokens derived from a long-lived user token do not expire, so clear
    // the cached page so the next call re-derives it from the fresh user token.
    this.page = null;

    const newCredentials: PlatformCredentials = {
      ...this.credentials,
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
    };
    this.credentials = newCredentials;
    return newCredentials;
  }

  async createPost(content: PostContent): Promise<PostResult> {
    try {
      if (!this.isConfigured()) {
        return { success: false, error: 'Service not configured' };
      }

      const page = await this.getPageCredentials(
        content.metadata?.pageId as string | undefined
      );
      const mediaUrls = content.mediaUrls || [];
      const firstMedia = mediaUrls[0];
      const isVideo = firstMedia
        ? /\.(mp4|mov|avi|m4v)(\?|$)/i.test(firstMedia)
        : false;

      let publish: FeedPublishResponse;

      if (firstMedia && isVideo) {
        publish = await this.makeRequest<FeedPublishResponse>(
          `/${page.id}/videos`,
          {
            method: 'POST',
            body: JSON.stringify({
              file_url: firstMedia,
              description: content.text,
            }),
          },
          page.accessToken
        );
      } else if (firstMedia) {
        publish = await this.makeRequest<FeedPublishResponse>(
          `/${page.id}/photos`,
          {
            method: 'POST',
            body: JSON.stringify({
              url: firstMedia,
              caption: content.text,
            }),
          },
          page.accessToken
        );
      } else {
        // Text / link post to the Page feed.
        const body: Record<string, string> = { message: content.text };
        if (content.linkUrl) body.link = content.linkUrl;
        publish = await this.makeRequest<FeedPublishResponse>(
          `/${page.id}/feed`,
          { method: 'POST', body: JSON.stringify(body) },
          page.accessToken
        );
      }

      const postId = publish.post_id || publish.id;
      if (!postId) {
        return { success: false, error: 'Facebook did not return a post id' };
      }
      return {
        success: true,
        postId,
        url: `https://www.facebook.com/${postId}`,
      };
    } catch (error: unknown) {
      logger.error('Facebook post creation failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deletePost(postId: string): Promise<boolean> {
    try {
      if (!this.isConfigured()) return false;
      const page = await this.getPageCredentials();
      await this.makeRequest<{ success?: boolean }>(
        `/${postId}`,
        { method: 'DELETE' },
        page.accessToken
      );
      return true;
    } catch (error) {
      logger.error('Facebook post deletion failed', { postId, error });
      return false;
    }
  }

  async getPostMetrics(postId: string): Promise<FacebookPostMetrics | null> {
    try {
      if (!this.isConfigured()) return null;
      const page = await this.getPageCredentials();
      const data = await this.makeRequest<PagePostElement & {
        insights?: { data?: Array<{ name: string; values?: Array<{ value?: number }> }> };
      }>(
        `/${postId}?fields=likes.summary(true),comments.summary(true),shares,` +
          `insights.metric(post_impressions,post_impressions_unique,post_engaged_users)`,
        {},
        page.accessToken
      );

      let impressions = 0;
      let reach = 0;
      let engagement = 0;
      for (const insight of data.insights?.data || []) {
        const value = insight.values?.[0]?.value || 0;
        if (insight.name === 'post_impressions') impressions = value;
        else if (insight.name === 'post_impressions_unique') reach = value;
        else if (insight.name === 'post_engaged_users') engagement = value;
      }

      return {
        likes: data.likes?.summary?.total_count || 0,
        comments: data.comments?.summary?.total_count || 0,
        shares: data.shares?.count || 0,
        impressions,
        reach,
        engagement,
      };
    } catch (error) {
      logger.error('Facebook post metrics fetch failed', { postId, error });
      return null;
    }
  }

  async syncProfile(): Promise<SyncProfileResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          profile: { id: '', username: '', displayName: '', followers: 0, following: 0, postsCount: 0 },
          error: 'Service not configured',
        };
      }
      const page = await this.getPageCredentials();
      const profile = await this.makeRequest<PageProfileResponse>(
        `/${page.id}?fields=id,name,username,about,picture,fan_count,link`,
        {},
        page.accessToken
      );
      return {
        success: true,
        profile: {
          id: profile.id,
          username: profile.username || profile.name || '',
          displayName: profile.name || '',
          bio: profile.about || '',
          avatarUrl: profile.picture?.data?.url || '',
          followers: profile.fan_count || 0,
          following: 0,
          postsCount: 0,
          verified: false,
          url: profile.link || `https://www.facebook.com/${profile.id}`,
        },
      };
    } catch (error: unknown) {
      logger.error('Facebook profile sync failed', { error });
      return {
        success: false,
        profile: { id: '', username: '', displayName: '', followers: 0, following: 0, postsCount: 0 },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async syncPosts(limit: number = 25, cursor?: string): Promise<SyncPostsResult> {
    try {
      if (!this.isConfigured()) {
        return { success: false, posts: [], total: 0, hasMore: false, error: 'Service not configured' };
      }
      const page = await this.getPageCredentials();
      const after = cursor ? `&after=${cursor}` : '';
      const response = await this.makeRequest<PagePostsResponse>(
        `/${page.id}/posts?fields=id,message,created_time,permalink_url,full_picture,` +
          `likes.summary(true),comments.summary(true),shares&limit=${limit}${after}`,
        {},
        page.accessToken
      );

      const posts = (response.data || []).map((p) => ({
        id: p.id,
        platformId: p.id,
        content: p.message || '',
        url: p.permalink_url || `https://www.facebook.com/${p.id}`,
        mediaUrls: p.full_picture ? [p.full_picture] : [],
        publishedAt: p.created_time ? new Date(p.created_time) : new Date(),
        metrics: {
          likes: p.likes?.summary?.total_count || 0,
          comments: p.comments?.summary?.total_count || 0,
          shares: p.shares?.count || 0,
        },
      }));

      const nextCursor = response.paging?.cursors?.after;
      return {
        success: true,
        posts,
        total: posts.length,
        hasMore: !!nextCursor,
        cursor: nextCursor,
      };
    } catch (error: unknown) {
      logger.error('Facebook posts sync failed', { error });
      return {
        success: false,
        posts: [],
        total: 0,
        hasMore: false,
        error: error instanceof Error ? error.message : String(error),
      };
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
      const page = await this.getPageCredentials();
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const profile = await this.makeRequest<PageProfileResponse>(
        `/${page.id}?fields=fan_count`,
        {},
        page.accessToken
      );

      const insights = await this.makeRequest<{
        data?: Array<{ name: string; values?: Array<{ value?: number }> }>;
      }>(
        `/${page.id}/insights?metric=page_impressions,page_post_engagements&` +
          `period=days_28&since=${Math.floor(startDate.getTime() / 1000)}&` +
          `until=${Math.floor(endDate.getTime() / 1000)}`,
        {},
        page.accessToken
      );

      let impressions = 0;
      let engagements = 0;
      for (const metric of insights.data || []) {
        const value = metric.values?.[metric.values.length - 1]?.value || 0;
        if (metric.name === 'page_impressions') impressions = value;
        else if (metric.name === 'page_post_engagements') engagements = value;
      }

      return {
        success: true,
        metrics: {
          impressions,
          engagements,
          followers: profile.fan_count || 0,
        },
        period: { start: startDate, end: endDate },
      };
    } catch (error: unknown) {
      logger.error('Facebook analytics sync failed', { error });
      return {
        success: false,
        metrics: { impressions: 0, engagements: 0, followers: 0 },
        period: { start: new Date(), end: new Date() },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
