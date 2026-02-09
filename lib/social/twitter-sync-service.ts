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

import { TwitterApi } from 'twitter-api-v2';
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

export class TwitterSyncService extends BasePlatformService {
  readonly platform = 'twitter';
  private client: TwitterApi | null = null;

  initialize(credentials: PlatformCredentials): void {
    super.initialize(credentials);

    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;

    if (apiKey && apiSecret && credentials.accessToken) {
      // For OAuth 1.0a user context
      // accessToken contains the user's access token
      // refreshToken contains the user's access token secret
      this.client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: credentials.accessToken,
        accessSecret: credentials.refreshToken || '',
      });
    } else if (credentials.accessToken) {
      // OAuth 2.0 Bearer token
      this.client = new TwitterApi(credentials.accessToken);
    }
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
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

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
          if ((tweet as any).organic_metrics) {
            impressions += (tweet as any).organic_metrics.impression_count || 0;
          }

          engagements += (tweet.public_metrics?.like_count || 0) +
            (tweet.public_metrics?.retweet_count || 0) +
            (tweet.public_metrics?.reply_count || 0) +
            (tweet.public_metrics?.quote_count || 0);
        }
      } catch (error) {
        logger.warn('Failed to fetch Twitter timeline for analytics', { error });
      }

      // Calculate daily breakdown
      const dailyBreakdown: Array<{ date: string; impressions: number; engagements: number }> = [];

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
    } catch (error: any) {
      logger.error('Twitter analytics sync failed', { error });
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

      const options: any = {
        max_results: Math.min(limit, 100),
        'tweet.fields': ['created_at', 'public_metrics', 'entities', 'attachments'],
        'media.fields': ['url', 'preview_image_url'],
        expansions: ['attachments.media_keys'],
      };

      if (cursor) {
        options.pagination_token = cursor;
      }

      const tweets = await this.client.v2.userTimeline(me.data.id, options);

      // Build media lookup
      const mediaLookup: Record<string, string> = {};
      if (tweets.includes?.media) {
        for (const media of tweets.includes.media) {
          mediaLookup[media.media_key] = media.url || media.preview_image_url || '';
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
    } catch (error: any) {
      logger.error('Twitter posts sync failed', { error });
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
          avatarUrl: me.data.profile_image_url?.replace('_normal', '_400x400') || '',
          followers: me.data.public_metrics?.followers_count || 0,
          following: me.data.public_metrics?.following_count || 0,
          postsCount: me.data.public_metrics?.tweet_count || 0,
          verified: me.data.verified || false,
          url: `https://twitter.com/${me.data.username}`,
        },
      };
    } catch (error: any) {
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
        error: error.message,
      };
    }
  }

  async createPost(content: PostContent): Promise<PostResult> {
    try {
      if (!this.isConfigured() || !this.client) {
        return { success: false, error: 'Service not configured' };
      }

      const me = await this.client.v2.me();

      const tweetData: any = {
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
            logger.warn('Failed to upload media to Twitter', { error, mediaUrl });
          }
        }

        if (mediaIds.length > 0) {
          tweetData.media = { media_ids: mediaIds };
        }
      }

      const result = await this.client.v2.tweet(tweetData);

      return {
        success: true,
        postId: result.data.id,
        url: `https://twitter.com/${me.data.username}/status/${result.data.id}`,
      };
    } catch (error: any) {
      logger.error('Twitter post creation failed', { error });
      return {
        success: false,
        error: error.message,
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
    } catch (error: any) {
      logger.error('Twitter post deletion failed', { error, postId });
      return false;
    }
  }

  async getPostMetrics(postId: string): Promise<any> {
    try {
      if (!this.isConfigured() || !this.client) {
        return null;
      }

      const tweet = await this.client.v2.singleTweet(postId, {
        'tweet.fields': ['public_metrics', 'organic_metrics'],
      });

      return {
        likes: tweet.data.public_metrics?.like_count || 0,
        retweets: tweet.data.public_metrics?.retweet_count || 0,
        replies: tweet.data.public_metrics?.reply_count || 0,
        quotes: tweet.data.public_metrics?.quote_count || 0,
        impressions: (tweet.data as any).organic_metrics?.impression_count || 0,
      };
    } catch (error: any) {
      logger.error('Twitter post metrics fetch failed', { error, postId });
      return null;
    }
  }
}

// Export singleton instance
export const twitterSyncService = new TwitterSyncService();
