/**
 * Twitter Sync Service
 *
 * @description Twitter API integration for syncing analytics, posts, and profiles
 * Extends the base TwitterService with sync capabilities
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - TWITTER_API_KEY: Twitter API key (SECRET)
 * - TWITTER_API_SECRET: Twitter API secret (SECRET)
 * - TWITTER_BEARER_TOKEN: Twitter bearer token for app-only auth (SECRET)
 *
 * User credentials (access token/secret) are stored per-user in PlatformConnection
 *
 * FAILURE MODE: Service will return error results, never throws for sync operations
 */

import {
  TwitterApi,
  TweetV2,
  TweetV2PaginableTimelineResult,
} from 'twitter-api-v2';
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

/** Extended tweet interface with organic metrics (requires elevated access) */
interface TweetWithOrganicMetrics {
  organic_metrics?: {
    impression_count?: number;
    user_profile_clicks?: number;
    retweet_count?: number;
    reply_count?: number;
    like_count?: number;
    url_link_clicks?: number;
  };
}

/** Twitter post metrics result */
interface TwitterPostMetrics {
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  impressions: number;
}

/** Media IDs tuple types for Twitter API */
type MediaIdsTuple =
  | [string]
  | [string, string]
  | [string, string, string]
  | [string, string, string, string];

/** Tweet data for creation */
interface TweetCreateData {
  text: string;
  media?: { media_ids: MediaIdsTuple };
}

export class TwitterSyncService extends BasePlatformService {
  readonly platform = 'twitter';
  private client: TwitterApi | null = null;
  /**
   * True when the connection uses OAuth 2.0 (PKCE user-context, per-user access
   * token that expires ~2h and carries a rotating refresh_token). False for
   * OAuth 1.0a (app-level keys + non-expiring user token). Only OAuth 2.0
   * connections can — and must — refresh; see refreshToken().
   */
  private isOAuth2 = false;

  initialize(credentials: PlatformCredentials): void {
    super.initialize(credentials);

    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;

    if (apiKey && apiSecret && credentials.accessToken) {
      // For OAuth 1.0a user context
      // accessToken contains the user's access token
      // refreshToken contains the user's access token secret
      this.isOAuth2 = false;
      this.client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: credentials.accessToken,
        accessSecret: credentials.refreshToken || '',
      });
    } else if (credentials.accessToken) {
      // OAuth 2.0 Bearer token (user-context, expires — refreshable)
      this.isOAuth2 = true;
      this.client = new TwitterApi(credentials.accessToken);
    }
  }

  protected override canRefreshToken(): boolean {
    return (
      this.isOAuth2 &&
      !!this.credentials?.refreshToken &&
      !!process.env.TWITTER_CLIENT_ID &&
      !!process.env.TWITTER_CLIENT_SECRET
    );
  }

  /**
   * Refresh an OAuth 2.0 user access token via X's token endpoint. X rotates
   * the refresh token on every use, so the new refresh_token MUST be persisted
   * (the base class fires tokenRefreshCallback with the returned credentials).
   * Without this, X access tokens die ~2h after connect and publishing silently
   * fails until manual reconnect.
   */
  async refreshToken(): Promise<PlatformCredentials> {
    if (!this.isOAuth2 || !this.credentials?.refreshToken) {
      throw new PlatformError(
        'twitter',
        'No OAuth 2.0 refresh token available to refresh'
      );
    }
    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new PlatformError(
        'twitter',
        'X OAuth 2.0 client credentials (TWITTER_CLIENT_ID/SECRET) not configured'
      );
    }

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    let response: Response;
    try {
      // This refresh runs inline before user-facing publish/read requests, so
      // cap it: a hanging X token endpoint must not block the request forever.
      response = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basic}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.credentials.refreshToken,
          client_id: clientId,
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (error: unknown) {
      throw new PlatformError(
        'twitter',
        error instanceof Error && error.name === 'TimeoutError'
          ? 'X token refresh timed out'
          : `X token refresh failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const data = await response.json();
    if (!response.ok || data.error || !data.access_token) {
      throw new PlatformError(
        'twitter',
        data.error_description || data.error || 'X token refresh failed',
        response.status
      );
    }

    const newCredentials: PlatformCredentials = {
      ...this.credentials,
      accessToken: data.access_token,
      // X rotates refresh tokens — keep the new one, fall back to the old.
      refreshToken: data.refresh_token || this.credentials.refreshToken,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : this.credentials.expiresAt,
    };

    this.credentials = newCredentials;
    // Re-init the client with the fresh bearer token so subsequent calls use it.
    this.client = new TwitterApi(newCredentials.accessToken);
    return newCredentials;
  }

  isConfigured(): boolean {
    return this.client !== null && super.isConfigured();
  }

  async validateCredentials(): Promise<boolean> {
    try {
      if (!this.client) return false;
      await this.client.v2.me();
      return true;
    } catch (error) {
      logger.error('Twitter credentials validation failed', { error });
      return false;
    }
  }

  async syncAnalytics(days: number = 30): Promise<SyncAnalyticsResult> {
    try {
      if (!this.isConfigured() || !this.client) {
        return {
          success: false,
          metrics: { impressions: 0, engagements: 0, followers: 0 },
          period: { start: new Date(), end: new Date() },
          error: 'Service not configured',
        };
      }

      const endDate = new Date();
      const startDate = new Date(
        endDate.getTime() - days * 24 * 60 * 60 * 1000
      );

      // Get user info for follower count
      const me = await this.client.v2.me({
        'user.fields': ['public_metrics'],
      });

      const followers = me.data.public_metrics?.followers_count || 0;
      const following = me.data.public_metrics?.following_count || 0;
      const tweetCount = me.data.public_metrics?.tweet_count || 0;

      // Get recent tweets for engagement metrics
      let impressions = 0;
      let engagements = 0;
      let likes = 0;
      let retweets = 0;
      let replies = 0;

      try {
        const tweets = await this.client.v2.userTimeline(me.data.id, {
          max_results: 100,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          'tweet.fields': ['public_metrics', 'organic_metrics', 'created_at'],
        });

        for await (const tweet of tweets) {
          if (tweet.public_metrics) {
            likes += tweet.public_metrics.like_count || 0;
            retweets += tweet.public_metrics.retweet_count || 0;
            replies += tweet.public_metrics.reply_count || 0;
          }

          // Organic metrics require elevated access
          const tweetWithMetrics = tweet as TweetWithOrganicMetrics;
          if (tweetWithMetrics.organic_metrics) {
            impressions +=
              tweetWithMetrics.organic_metrics.impression_count || 0;
          }

          engagements +=
            (tweet.public_metrics?.like_count || 0) +
            (tweet.public_metrics?.retweet_count || 0) +
            (tweet.public_metrics?.reply_count || 0) +
            (tweet.public_metrics?.quote_count || 0);
        }
      } catch (error) {
        logger.warn('Failed to fetch Twitter timeline for analytics', {
          error,
        });
      }

      // Calculate daily breakdown
      const dailyBreakdown: Array<{
        date: string;
        impressions: number;
        engagements: number;
      }> = [];

      return {
        success: true,
        metrics: {
          impressions,
          engagements,
          followers,
          following,
          posts: tweetCount,
          likes,
          comments: replies,
          shares: retweets,
        },
        period: {
          start: startDate,
          end: endDate,
        },
        breakdown: {
          daily: dailyBreakdown,
        },
      };
    } catch (error: unknown) {
      logger.error('Twitter analytics sync failed', { error });
      return {
        success: false,
        metrics: { impressions: 0, engagements: 0, followers: 0 },
        period: { start: new Date(), end: new Date() },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async syncPosts(
    limit: number = 20,
    cursor?: string
  ): Promise<SyncPostsResult> {
    try {
      if (!this.isConfigured() || !this.client) {
        return {
          success: false,
          posts: [],
          total: 0,
          hasMore: false,
          error: 'Service not configured',
        };
      }

      const me = await this.client.v2.me();

      const tweets = await this.client.v2.userTimeline(me.data.id, {
        max_results: Math.min(limit, 100),
        'tweet.fields': [
          'created_at',
          'public_metrics',
          'entities',
          'attachments',
        ],
        'media.fields': ['url', 'preview_image_url'],
        expansions: ['attachments.media_keys'],
        ...(cursor ? { pagination_token: cursor } : {}),
      });

      // Build media lookup
      const mediaLookup: Record<string, string> = {};
      if (tweets.includes?.media) {
        for (const media of tweets.includes.media) {
          mediaLookup[media.media_key] =
            media.url || media.preview_image_url || '';
        }
      }

      const posts = tweets.data.data.map(tweet => {
        // Get media URLs
        const mediaUrls: string[] = [];
        if (tweet.attachments?.media_keys) {
          for (const key of tweet.attachments.media_keys) {
            if (mediaLookup[key]) {
              mediaUrls.push(mediaLookup[key]);
            }
          }
        }

        return {
          id: tweet.id,
          platformId: tweet.id,
          content: tweet.text,
          mediaUrls,
          publishedAt: new Date(tweet.created_at || Date.now()),
          metrics: {
            likes: tweet.public_metrics?.like_count || 0,
            comments: tweet.public_metrics?.reply_count || 0,
            shares: tweet.public_metrics?.retweet_count || 0,
            impressions: 0, // Requires elevated access
          },
          url: `https://twitter.com/${me.data.username}/status/${tweet.id}`,
        };
      });

      const nextCursor = tweets.data.meta.next_token;

      return {
        success: true,
        posts,
        total: tweets.data.meta.result_count,
        hasMore: !!nextCursor,
        cursor: nextCursor,
      };
    } catch (error: unknown) {
      logger.error('Twitter posts sync failed', { error });
      return {
        success: false,
        posts: [],
        total: 0,
        hasMore: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async syncProfile(): Promise<SyncProfileResult> {
    try {
      if (!this.isConfigured() || !this.client) {
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

      const me = await this.client.v2.me({
        'user.fields': [
          'id',
          'username',
          'name',
          'description',
          'profile_image_url',
          'public_metrics',
          'verified',
          'url',
        ],
      });

      return {
        success: true,
        profile: {
          id: me.data.id,
          username: me.data.username,
          displayName: me.data.name,
          bio: me.data.description || '',
          avatarUrl:
            me.data.profile_image_url?.replace('_normal', '_400x400') || '',
          followers: me.data.public_metrics?.followers_count || 0,
          following: me.data.public_metrics?.following_count || 0,
          postsCount: me.data.public_metrics?.tweet_count || 0,
          verified: me.data.verified || false,
          url: `https://twitter.com/${me.data.username}`,
        },
      };
    } catch (error: unknown) {
      logger.error('Twitter profile sync failed', { error });
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

  async createPost(content: PostContent): Promise<PostResult> {
    try {
      if (!this.isConfigured() || !this.client) {
        return { success: false, error: 'Service not configured' };
      }

      const me = await this.client.v2.me();

      const tweetData: TweetCreateData = {
        text: content.text,
      };

      // Upload media if provided
      if (content.mediaUrls && content.mediaUrls.length > 0) {
        const mediaIds: string[] = [];

        for (const mediaUrl of content.mediaUrls.slice(0, 4)) {
          try {
            // Download media and upload to Twitter
            const response = await fetch(mediaUrl);
            const buffer = Buffer.from(await response.arrayBuffer());
            const mediaId = await this.client.v1.uploadMedia(buffer, {
              mimeType: response.headers.get('content-type') || 'image/jpeg',
            });
            mediaIds.push(mediaId);
          } catch (error) {
            logger.warn('Failed to upload media to Twitter', {
              error,
              mediaUrl,
            });
          }
        }

        if (mediaIds.length > 0 && mediaIds.length <= 4) {
          // Cast to tuple type as Twitter API requires 1-4 media IDs
          tweetData.media = { media_ids: mediaIds as MediaIdsTuple };
        }
      }

      const result = await this.client.v2.tweet(tweetData);

      return {
        success: true,
        postId: result.data.id,
        url: `https://twitter.com/${me.data.username}/status/${result.data.id}`,
      };
    } catch (error: unknown) {
      logger.error('Twitter post creation failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deletePost(postId: string): Promise<boolean> {
    try {
      if (!this.isConfigured() || !this.client) {
        return false;
      }

      await this.client.v2.deleteTweet(postId);
      return true;
    } catch (error: unknown) {
      logger.error('Twitter post deletion failed', { error, postId });
      return false;
    }
  }

  async getPostMetrics(postId: string): Promise<TwitterPostMetrics | null> {
    try {
      if (!this.isConfigured() || !this.client) {
        return null;
      }

      const tweet = await this.client.v2.singleTweet(postId, {
        'tweet.fields': ['public_metrics', 'organic_metrics'],
      });

      const tweetWithMetrics = tweet.data as TweetWithOrganicMetrics;

      return {
        likes: tweet.data.public_metrics?.like_count || 0,
        retweets: tweet.data.public_metrics?.retweet_count || 0,
        replies: tweet.data.public_metrics?.reply_count || 0,
        quotes: tweet.data.public_metrics?.quote_count || 0,
        impressions: tweetWithMetrics.organic_metrics?.impression_count || 0,
      };
    } catch (error: unknown) {
      logger.error('Twitter post metrics fetch failed', { error, postId });
      return null;
    }
  }
}

// Export singleton instance
export const twitterSyncService = new TwitterSyncService();
