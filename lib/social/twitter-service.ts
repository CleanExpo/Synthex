/**
 * ENVIRONMENT VARIABLES REQUIRED:
 * - TWITTER_API_KEY: Twitter API key (SECRET)
 * - TWITTER_API_SECRET: Twitter API secret (SECRET)
 * - TWITTER_ACCESS_TOKEN: Twitter access token (SECRET)
 * - TWITTER_ACCESS_SECRET: Twitter access token secret (SECRET)
 * - TWITTER_BEARER_TOKEN: Twitter bearer token for app-only auth (SECRET)
 * 
 * FAILURE MODE: Service will fail gracefully with error messages
 */

import { TwitterApi, TwitterApiV2Settings } from 'twitter-api-v2';

// Configure Twitter API settings
TwitterApiV2Settings.debug = process.env.NODE_ENV === 'development';

export interface TwitterPost {
  text: string;
  mediaIds?: string[];
  replyToId?: string;
}

export interface TwitterThread {
  tweets: string[];
  mediaIds?: string[][];
}

export interface TwitterMetrics {
  impressions: number;
  engagements: number;
  likes: number;
  retweets: number;
  replies: number;
  url_clicks: number;
  profile_visits: number;
}

export class TwitterService {
  private client: TwitterApi | null = null;
  private v2Client: any = null;

  constructor() {
    this.initializeClient();
  }

  /**
   * Initialize Twitter client with credentials
   */
  private initializeClient() {
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessSecret = process.env.TWITTER_ACCESS_SECRET;
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;

    if (apiKey && apiSecret && accessToken && accessSecret) {
      // User context authentication (for posting)
      this.client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessSecret,
      });
      this.v2Client = this.client.v2;
    } else if (bearerToken) {
      // App-only authentication (for reading)
      this.client = new TwitterApi(bearerToken);
      this.v2Client = this.client.v2;
    } else {
      console.warn('Twitter API credentials not configured. Social posting features will be limited.');
    }
  }

  /**
   * Post a single tweet
   */
  async postTweet(post: TwitterPost): Promise<any> {
    if (!this.v2Client) {
      throw new Error('Twitter API not configured. Please set Twitter credentials.');
    }

    try {
      const tweetData: any = {
        text: post.text,
      };

      if (post.mediaIds && post.mediaIds.length > 0) {
        tweetData.media = { media_ids: post.mediaIds };
      }

      if (post.replyToId) {
        tweetData.reply = { in_reply_to_tweet_id: post.replyToId };
      }

      const result = await this.v2Client.tweet(tweetData);
      
      return {
        success: true,
        data: result.data,
        id: result.data.id,
        text: result.data.text,
      };
    } catch (error: unknown) {
      console.error('Twitter post error:', error);
      throw new Error(`Failed to post tweet: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Post a thread of tweets
   */
  async postThread(thread: TwitterThread): Promise<any[]> {
    if (!this.v2Client) {
      throw new Error('Twitter API not configured');
    }

    const results: any[] = [];
    let previousTweetId: string | undefined;

    for (let i = 0; i < thread.tweets.length; i++) {
      const tweetText = thread.tweets[i];
      const mediaIds = thread.mediaIds?.[i];

      try {
        const post: TwitterPost = {
          text: tweetText,
          mediaIds,
          replyToId: previousTweetId,
        };

        const result = await this.postTweet(post);
        results.push(result);
        previousTweetId = result.id;

        // Add a small delay between tweets to avoid rate limiting
        if (i < thread.tweets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Failed to post tweet ${i + 1} in thread:`, error);
        break;
      }
    }

    return results;
  }

  /**
   * Upload media to Twitter
   */
  async uploadMedia(filePath: string): Promise<string> {
    if (!this.client) {
      throw new Error('Twitter API not configured');
    }

    try {
      const mediaId = await this.client.v1.uploadMedia(filePath);
      return mediaId;
    } catch (error: unknown) {
      console.error('Media upload error:', error);
      throw new Error(`Failed to upload media: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get tweet metrics (requires elevated access)
   */
  async getTweetMetrics(tweetId: string): Promise<TwitterMetrics | null> {
    if (!this.v2Client) {
      throw new Error('Twitter API not configured');
    }

    try {
      const tweet = await this.v2Client.singleTweet(tweetId, {
        'tweet.fields': ['public_metrics', 'organic_metrics', 'promoted_metrics'],
      });

      if (tweet.data.public_metrics) {
        return {
          impressions: tweet.data.organic_metrics?.impression_count || 0,
          engagements: tweet.data.organic_metrics?.user_profile_clicks || 0,
          likes: tweet.data.public_metrics.like_count,
          retweets: tweet.data.public_metrics.retweet_count,
          replies: tweet.data.public_metrics.reply_count,
          url_clicks: tweet.data.organic_metrics?.url_link_clicks || 0,
          profile_visits: tweet.data.organic_metrics?.user_profile_clicks || 0,
        };
      }

      return null;
    } catch (error: unknown) {
      console.error('Failed to get tweet metrics:', error);
      return null;
    }
  }

  /**
   * Get user timeline
   */
  async getUserTimeline(username: string, maxResults: number = 10): Promise<any[]> {
    if (!this.v2Client) {
      throw new Error('Twitter API not configured');
    }

    try {
      // Get user by username
      const user = await this.v2Client.userByUsername(username);
      if (!user.data) {
        throw new Error('User not found');
      }

      // Get user's tweets
      const timeline = await this.v2Client.userTimeline(user.data.id, {
        max_results: maxResults,
        'tweet.fields': ['created_at', 'public_metrics', 'entities'],
      });

      return timeline.data || [];
    } catch (error: unknown) {
      console.error('Failed to get user timeline:', error);
      throw new Error(`Failed to get timeline: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Search tweets
   */
  async searchTweets(query: string, maxResults: number = 10): Promise<any[]> {
    if (!this.v2Client) {
      throw new Error('Twitter API not configured');
    }

    try {
      const tweets = await this.v2Client.search(query, {
        max_results: maxResults,
        'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
      });

      return tweets.data || [];
    } catch (error: unknown) {
      console.error('Search error:', error);
      throw new Error(`Failed to search tweets: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a tweet
   */
  async deleteTweet(tweetId: string): Promise<boolean> {
    if (!this.v2Client) {
      throw new Error('Twitter API not configured');
    }

    try {
      await this.v2Client.deleteTweet(tweetId);
      return true;
    } catch (error: unknown) {
      console.error('Delete error:', error);
      throw new Error(`Failed to delete tweet: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Schedule a tweet (requires external scheduling service)
   */
  async scheduleTweet(post: TwitterPost, scheduledTime: Date): Promise<any> {
    // Note: Twitter API doesn't support native scheduling
    // This would need to be implemented with a job queue or external service
    return {
      scheduled: true,
      scheduledTime,
      post,
      message: 'Tweet scheduled successfully (requires job queue implementation)',
    };
  }

  /**
   * Validate tweet text
   */
  validateTweet(text: string): { valid: boolean; error?: string } {
    if (!text || text.trim().length === 0) {
      return { valid: false, error: 'Tweet text cannot be empty' };
    }

    if (text.length > 280) {
      return { valid: false, error: `Tweet is ${text.length} characters (max 280)` };
    }

    return { valid: true };
  }

  /**
   * Split long text into thread
   */
  splitIntoThread(text: string, maxLength: number = 270): string[] {
    const tweets: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentTweet = '';

    for (const sentence of sentences) {
      if ((currentTweet + ' ' + sentence).length <= maxLength) {
        currentTweet = currentTweet ? `${currentTweet} ${sentence}` : sentence;
      } else {
        if (currentTweet) {
          tweets.push(currentTweet);
        }
        currentTweet = sentence;
      }
    }

    if (currentTweet) {
      tweets.push(currentTweet);
    }

    // Add thread numbering
    if (tweets.length > 1) {
      return tweets.map((tweet, index) => `${index + 1}/${tweets.length} ${tweet}`);
    }

    return tweets;
  }
}

// Export singleton instance
export const twitterService = new TwitterService();