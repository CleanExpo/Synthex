/**
 * Reddit Platform Service
 *
 * @description Reddit API integration via OAuth (https://oauth.reddit.com/)
 * Supports posting, analytics sync, and profile management
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - REDDIT_CLIENT_ID: Reddit API client ID (SECRET)
 * - REDDIT_CLIENT_SECRET: Reddit API client secret (SECRET)
 *
 * User credentials are stored per-user in the database (PlatformConnection)
 *
 * FAILURE MODE: Service will return error results, never throws for sync operations
 *
 * IMPORTANT: Reddit API requires:
 * - Descriptive User-Agent header on ALL requests (429 without it)
 * - POST requests use application/x-www-form-urlencoded (NOT JSON)
 * - Posts require both title and subreddit
 * - Delete uses t3_ prefix for post IDs
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

// ============================================================================
// REDDIT API RESPONSE TYPES
// ============================================================================

/** Reddit user info (GET /api/v1/me) */
interface RedditUserInfo {
  id: string;
  name: string;
  icon_img?: string;
  link_karma: number;
  comment_karma: number;
  total_karma?: number;
  created_utc: number;
  subreddit?: {
    display_name?: string;
    subscribers?: number;
    title?: string;
    public_description?: string;
    banner_img?: string;
    icon_img?: string;
  };
  is_gold?: boolean;
  has_verified_email?: boolean;
  num_friends?: number;
}

/** Reddit karma breakdown item */
interface RedditKarmaItem {
  sr: string;
  comment_karma: number;
  link_karma: number;
}

/** Reddit karma response */
interface RedditKarmaResponse {
  kind: string;
  data: RedditKarmaItem[];
}

/** Reddit listing response (generic) */
interface RedditListing<T> {
  kind: string;
  data: {
    after?: string;
    before?: string;
    children: Array<{
      kind: string;
      data: T;
    }>;
    dist?: number;
  };
}

/** Reddit post/submission data */
interface RedditPostData {
  id: string;
  name: string; // fullname e.g. t3_abc123
  title: string;
  selftext?: string;
  url?: string;
  subreddit: string;
  subreddit_name_prefixed?: string;
  score: number;
  ups: number;
  downs: number;
  num_comments: number;
  upvote_ratio: number;
  created_utc: number;
  permalink: string;
  is_self: boolean;
  thumbnail?: string;
  preview?: {
    images?: Array<{
      source?: { url: string; width: number; height: number };
    }>;
  };
  view_count?: number;
}

/** Reddit submit response */
interface RedditSubmitResponse {
  json: {
    errors: string[][];
    data?: {
      url: string;
      id: string;
      name: string; // fullname e.g. t3_abc123
    };
  };
}

/** Reddit subreddit data */
interface RedditSubredditData {
  display_name: string;
  subscribers: number;
  subreddit_type: string;
  public_description?: string;
  icon_img?: string;
}

/** Reddit subreddit rule */
interface RedditSubredditRule {
  kind: string;
  short_name: string;
  description: string;
  violation_reason: string;
  created_utc: number;
}

/** Reddit subreddit rules response */
interface RedditSubredditRulesResponse {
  rules: RedditSubredditRule[];
  site_rules?: string[];
}

/** Reddit post metrics */
interface RedditPostMetrics {
  score: number;
  ups: number;
  downs: number;
  numComments: number;
  upvoteRatio: number;
  viewCount: number | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const REDDIT_API_BASE = 'https://oauth.reddit.com';
const USER_AGENT = 'Synthex/1.0';

// ============================================================================
// SERVICE
// ============================================================================

export class RedditService extends BasePlatformService {
  readonly platform = 'reddit';

  /**
   * Make an authenticated GET request to the Reddit API
   */
  private async makeGetRequest<T>(endpoint: string): Promise<T> {
    await this.ensureValidToken();

    if (!this.credentials?.accessToken) {
      throw new PlatformError('reddit', 'No access token configured');
    }

    const url = `${REDDIT_API_BASE}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.credentials.accessToken}`,
          'User-Agent': USER_AGENT,
        },
      });

      // Update rate limits from response headers
      const rateLimitHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        if (key.startsWith('x-ratelimit')) {
          rateLimitHeaders[key] = value;
        }
      });
      if (Object.keys(rateLimitHeaders).length > 0) {
        this.updateRateLimits(endpoint, rateLimitHeaders);
      }

      const data = await response.json();

      // Handle token expired — attempt refresh and retry
      if (response.status === 401) {
        logger.warn('[reddit] Token expired during GET request, attempting refresh...', {
          status: response.status,
        });

        try {
          await this.refreshToken();

          const retryResponse = await fetch(url, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${this.credentials.accessToken}`,
              'User-Agent': USER_AGENT,
            },
          });

          const retryData = await retryResponse.json();

          if (!retryResponse.ok) {
            throw new PlatformError(
              'reddit',
              retryData.message || `API request failed after token refresh: ${retryResponse.status}`,
              retryResponse.status
            );
          }

          return retryData;
        } catch (refreshError) {
          if (refreshError instanceof PlatformError) throw refreshError;
          logger.error('[reddit] Token refresh failed during retry', { error: refreshError });
          throw new PlatformError(
            'reddit',
            'Token expired and refresh failed. Please re-authenticate.',
            401
          );
        }
      }

      if (!response.ok) {
        throw new PlatformError(
          'reddit',
          data.message || data.error || `API request failed: ${response.status}`,
          response.status
        );
      }

      return data;
    } catch (error: unknown) {
      if (error instanceof PlatformError) throw error;
      const originalError = error instanceof Error ? error : undefined;
      throw new PlatformError(
        'reddit',
        error instanceof Error ? error.message : String(error),
        undefined,
        originalError
      );
    }
  }

  /**
   * Make an authenticated POST request to the Reddit API
   * IMPORTANT: Reddit POST requests use application/x-www-form-urlencoded
   */
  private async makePostRequest<T>(
    endpoint: string,
    params: Record<string, string>
  ): Promise<T> {
    await this.ensureValidToken();

    if (!this.credentials?.accessToken) {
      throw new PlatformError('reddit', 'No access token configured');
    }

    const url = `${REDDIT_API_BASE}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.credentials.accessToken}`,
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
      });

      // Update rate limits from response headers
      const rateLimitHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        if (key.startsWith('x-ratelimit')) {
          rateLimitHeaders[key] = value;
        }
      });
      if (Object.keys(rateLimitHeaders).length > 0) {
        this.updateRateLimits(endpoint, rateLimitHeaders);
      }

      const data = await response.json();

      // Handle token expired — attempt refresh and retry
      if (response.status === 401) {
        logger.warn('[reddit] Token expired during POST request, attempting refresh...', {
          status: response.status,
        });

        try {
          await this.refreshToken();

          const retryResponse = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.credentials.accessToken}`,
              'User-Agent': USER_AGENT,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(params),
          });

          const retryData = await retryResponse.json();

          if (!retryResponse.ok) {
            throw new PlatformError(
              'reddit',
              retryData.message || `API request failed after token refresh: ${retryResponse.status}`,
              retryResponse.status
            );
          }

          return retryData;
        } catch (refreshError) {
          if (refreshError instanceof PlatformError) throw refreshError;
          logger.error('[reddit] Token refresh failed during retry', { error: refreshError });
          throw new PlatformError(
            'reddit',
            'Token expired and refresh failed. Please re-authenticate.',
            401
          );
        }
      }

      if (!response.ok) {
        throw new PlatformError(
          'reddit',
          data.message || data.error || `API request failed: ${response.status}`,
          response.status
        );
      }

      return data;
    } catch (error: unknown) {
      if (error instanceof PlatformError) throw error;
      const originalError = error instanceof Error ? error : undefined;
      throw new PlatformError(
        'reddit',
        error instanceof Error ? error.message : String(error),
        undefined,
        originalError
      );
    }
  }

  /**
   * Override canRefreshToken to indicate Reddit supports token refresh
   */
  protected override canRefreshToken(): boolean {
    return !!this.credentials?.refreshToken;
  }

  /**
   * Refresh access token using Reddit OAuth endpoint
   * Reddit requires Basic auth (client_id:client_secret)
   */
  async refreshToken(): Promise<PlatformCredentials> {
    if (!this.credentials?.refreshToken) {
      throw new PlatformError('reddit', 'No refresh token available');
    }

    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new PlatformError('reddit', 'Reddit app credentials not configured');
    }

    try {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      const response = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
          'User-Agent': USER_AGENT,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.credentials.refreshToken,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new PlatformError(
          'reddit',
          data.error_description || data.error || 'Token refresh failed',
          response.status
        );
      }

      const newCredentials: PlatformCredentials = {
        ...this.credentials,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || this.credentials.refreshToken,
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000)
          : this.credentials.expiresAt,
      };

      this.credentials = newCredentials;
      return newCredentials;
    } catch (error: unknown) {
      if (error instanceof PlatformError) throw error;
      throw new PlatformError(
        'reddit',
        `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      if (!this.isConfigured()) return false;

      // Try to fetch user info — if it works, credentials are valid
      await this.makeGetRequest<RedditUserInfo>('/api/v1/me');
      return true;
    } catch (error) {
      logger.error('Reddit credentials validation failed', { error });
      return false;
    }
  }

  /**
   * Sync analytics data from Reddit
   *
   * Reddit doesn't expose post-level analytics to third parties.
   * We fetch account info (/api/v1/me) and karma breakdown (/api/v1/me/karma).
   * Returns: link_karma, comment_karma, total_karma, subreddit_count.
   */
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

      // Fetch user info for basic stats
      const userInfo = await this.makeGetRequest<RedditUserInfo>('/api/v1/me');

      const linkKarma = userInfo.link_karma || 0;
      const commentKarma = userInfo.comment_karma || 0;
      const totalKarma = userInfo.total_karma || (linkKarma + commentKarma);

      // Fetch karma breakdown by subreddit
      let subredditCount = 0;
      try {
        const karmaResponse = await this.makeGetRequest<RedditKarmaResponse>('/api/v1/me/karma');
        subredditCount = karmaResponse.data?.length || 0;
      } catch (error) {
        logger.warn('[reddit] Karma breakdown fetch failed, continuing with user info', { error });
      }

      // Reddit doesn't have traditional impressions/followers — map what's available
      const followers = userInfo.subreddit?.subscribers || 0;

      return {
        success: true,
        metrics: {
          impressions: 0, // Reddit doesn't expose impressions to API consumers
          engagements: totalKarma, // Karma is the closest proxy for engagement
          followers,
          likes: linkKarma,
          comments: commentKarma,
          posts: subredditCount, // subreddits with karma activity
        },
        period: {
          start: startDate,
          end: endDate,
        },
      };
    } catch (error: unknown) {
      logger.error('Reddit analytics sync failed', { error });
      return {
        success: false,
        metrics: { impressions: 0, engagements: 0, followers: 0 },
        period: { start: new Date(), end: new Date() },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Sync posts (submissions) from Reddit
   *
   * GET /user/{username}/submitted?limit={limit}&after={cursor}
   * Returns user's submissions with id, title, selftext, url, subreddit, score, etc.
   */
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

      // First get username
      const userInfo = await this.makeGetRequest<RedditUserInfo>('/api/v1/me');
      const username = userInfo.name;

      if (!username) {
        throw new PlatformError('reddit', 'Could not determine Reddit username');
      }

      let endpoint = `/user/${username}/submitted?limit=${Math.min(limit, 100)}`;
      if (cursor) {
        endpoint += `&after=${cursor}`;
      }

      const response = await this.makeGetRequest<RedditListing<RedditPostData>>(endpoint);

      const posts = (response.data?.children || []).map((child) => {
        const post = child.data;

        // Build content from title + selftext
        const content = post.selftext
          ? `${post.title}\n\n${post.selftext}`
          : post.title;

        // Extract media URLs from preview if available
        const mediaUrls: string[] = [];
        if (post.preview?.images?.[0]?.source?.url) {
          // Reddit HTML-encodes URLs in preview
          mediaUrls.push(post.preview.images[0].source.url.replace(/&amp;/g, '&'));
        } else if (!post.is_self && post.url) {
          // For link posts, include the linked URL
          mediaUrls.push(post.url);
        }

        return {
          id: post.id,
          platformId: post.id,
          content,
          mediaUrls,
          publishedAt: new Date(post.created_utc * 1000),
          metrics: {
            likes: post.ups || 0,
            comments: post.num_comments || 0,
            shares: 0, // Reddit doesn't expose share count via API
            impressions: post.view_count || 0,
          },
          url: `https://www.reddit.com${post.permalink}`,
        };
      });

      const afterToken = response.data?.after;

      return {
        success: true,
        posts,
        total: posts.length,
        hasMore: !!afterToken,
        cursor: afterToken || undefined,
      };
    } catch (error: unknown) {
      logger.error('Reddit posts sync failed', { error });
      return {
        success: false,
        posts: [],
        total: 0,
        hasMore: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Sync profile information from Reddit
   *
   * GET /api/v1/me — returns name, icon_img, karma, created_utc, subreddit profile
   */
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

      const userInfo = await this.makeGetRequest<RedditUserInfo>('/api/v1/me');

      // Clean icon_img URL (remove query params)
      const avatarUrl = userInfo.icon_img
        ? userInfo.icon_img.split('?')[0]
        : '';

      return {
        success: true,
        profile: {
          id: userInfo.id,
          username: userInfo.name,
          displayName: userInfo.subreddit?.title || userInfo.name,
          bio: userInfo.subreddit?.public_description || '',
          avatarUrl,
          coverUrl: userInfo.subreddit?.banner_img || '',
          followers: userInfo.subreddit?.subscribers || 0,
          following: userInfo.num_friends || 0,
          postsCount: 0, // Reddit doesn't expose post count in /me
          verified: userInfo.has_verified_email || false,
          url: `https://www.reddit.com/user/${userInfo.name}`,
        },
      };
    } catch (error: unknown) {
      logger.error('Reddit profile sync failed', { error });
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
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create a new Reddit post
   *
   * POST /api/submit with form-encoded body:
   * - kind: 'self' (text post) or 'link' (URL post)
   * - sr: subreddit name (REQUIRED)
   * - title: REQUIRED (Reddit posts must have titles)
   * - text: for self posts
   * - url: for link posts
   * - flair_id, flair_text, nsfw, spoiler: optional
   *
   * IMPORTANT: Uses URLSearchParams, NOT JSON
   */
  async createPost(content: PostContent): Promise<PostResult> {
    try {
      if (!this.isConfigured()) {
        return { success: false, error: 'Service not configured' };
      }

      // Extract Reddit-specific metadata
      const metadata = (content as PostContent & { metadata?: Record<string, unknown> }).metadata;
      const subreddit = metadata?.subreddit as string | undefined;
      const title = metadata?.title as string | undefined;
      const kind = (metadata?.kind as string) || 'self';

      // Validate required fields
      if (!subreddit) {
        return {
          success: false,
          error: 'Reddit posts require a subreddit. Please specify which subreddit to post to.',
        };
      }

      if (!title) {
        return {
          success: false,
          error: 'Reddit posts require a title.',
        };
      }

      // Build form parameters
      const params: Record<string, string> = {
        api_type: 'json',
        kind,
        sr: subreddit,
        title,
      };

      // Add content based on post kind
      if (kind === 'self') {
        params.text = content.text || '';
      } else if (kind === 'link') {
        // For link posts, use linkUrl or first mediaUrl
        const linkUrl = content.linkUrl || content.mediaUrls?.[0];
        if (!linkUrl) {
          return {
            success: false,
            error: 'Link posts require a URL. Provide linkUrl or mediaUrls.',
          };
        }
        params.url = linkUrl;
      }

      // Optional fields from metadata
      if (metadata?.flair_id) {
        params.flair_id = metadata.flair_id as string;
      }
      if (metadata?.flair_text) {
        params.flair_text = metadata.flair_text as string;
      }
      if (metadata?.nsfw === true) {
        params.nsfw = 'true';
      }
      if (metadata?.spoiler === true) {
        params.spoiler = 'true';
      }

      const result = await this.makePostRequest<RedditSubmitResponse>('/api/submit', params);

      // Check for Reddit API errors
      if (result.json?.errors && result.json.errors.length > 0) {
        const errorMessages = result.json.errors.map((e) => e.join(': ')).join('; ');
        return {
          success: false,
          error: `Reddit API error: ${errorMessages}`,
        };
      }

      const postData = result.json?.data;
      if (!postData?.id) {
        return { success: false, error: 'Failed to create Reddit post — no post ID returned' };
      }

      return {
        success: true,
        postId: postData.id,
        url: postData.url || `https://www.reddit.com${postData.name ? `/comments/${postData.id}` : ''}`,
      };
    } catch (error: unknown) {
      logger.error('Reddit post creation failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete a Reddit post
   *
   * POST /api/del with id=t3_{postId}
   * The t3_ prefix identifies link/post type things on Reddit
   */
  async deletePost(postId: string): Promise<boolean> {
    try {
      if (!this.isConfigured()) {
        return false;
      }

      // Add t3_ prefix if not already present (t3_ = link/post type)
      const fullname = postId.startsWith('t3_') ? postId : `t3_${postId}`;

      await this.makePostRequest<Record<string, unknown>>('/api/del', {
        id: fullname,
      });

      return true;
    } catch (error: unknown) {
      logger.error('Reddit post deletion failed', { error, postId });
      return false;
    }
  }

  /**
   * Get metrics for a specific Reddit post
   *
   * GET /api/info?id=t3_{postId}
   * Returns: score, ups, downs, num_comments, upvote_ratio, view_count
   */
  async getPostMetrics(postId: string): Promise<RedditPostMetrics | null> {
    try {
      if (!this.isConfigured()) {
        return null;
      }

      // Add t3_ prefix if not already present
      const fullname = postId.startsWith('t3_') ? postId : `t3_${postId}`;

      const response = await this.makeGetRequest<RedditListing<RedditPostData>>(
        `/api/info?id=${fullname}`
      );

      const post = response.data?.children?.[0]?.data;

      if (!post) {
        logger.warn('Reddit post not found for metrics', { postId });
        return null;
      }

      return {
        score: post.score || 0,
        ups: post.ups || 0,
        downs: post.downs || 0,
        numComments: post.num_comments || 0,
        upvoteRatio: post.upvote_ratio || 0,
        viewCount: post.view_count ?? null,
      };
    } catch (error: unknown) {
      logger.error('Reddit post metrics fetch failed', { error, postId });
      return null;
    }
  }

  // ============================================================================
  // REDDIT-SPECIFIC HELPERS
  // ============================================================================

  /**
   * Get user's subscribed subreddits
   *
   * GET /subreddits/mine/subscriber?limit=100
   * Returns list of subreddits with name, subscribers, type
   */
  async getSubreddits(): Promise<Array<{ name: string; subscribers: number; type: string }>> {
    try {
      if (!this.isConfigured()) {
        return [];
      }

      const response = await this.makeGetRequest<RedditListing<RedditSubredditData>>(
        '/subreddits/mine/subscriber?limit=100'
      );

      return (response.data?.children || []).map((child) => ({
        name: child.data.display_name,
        subscribers: child.data.subscribers,
        type: child.data.subreddit_type,
      }));
    } catch (error: unknown) {
      logger.error('Reddit subreddits fetch failed', { error });
      return [];
    }
  }

  /**
   * Get subreddit rules
   *
   * GET /r/{subreddit}/about/rules
   * Needed before posting to validate against subreddit-specific rules
   */
  async getSubredditRules(
    subreddit: string
  ): Promise<Array<{ name: string; description: string; violationReason: string }>> {
    try {
      if (!this.isConfigured()) {
        return [];
      }

      const response = await this.makeGetRequest<RedditSubredditRulesResponse>(
        `/r/${subreddit}/about/rules`
      );

      return (response.rules || []).map((rule) => ({
        name: rule.short_name,
        description: rule.description,
        violationReason: rule.violation_reason,
      }));
    } catch (error: unknown) {
      logger.error('Reddit subreddit rules fetch failed', { error, subreddit });
      return [];
    }
  }
}

// Export singleton instance
export const redditService = new RedditService();
