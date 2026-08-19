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
import type { PostContent, PostResult } from './base-platform-service';
import { PlatformError } from './base-platform-service';

// Configure Twitter API settings
TwitterApiV2Settings.debug = process.env.NODE_ENV === 'development';

/**
 * X media upload runs on a dedicated host (`upload.x.com`), not the default
 * `api.x.com` the v1 client prefixes onto every request. Passing this as the
 * per-request `prefix` targets the chunked-upload endpoint.
 */
const TWITTER_UPLOAD_PREFIX = 'https://upload.x.com/1.1/';

/** X APPEND chunk ceiling — each base64 segment must stay ≤5MB of raw bytes. */
const TWITTER_VIDEO_CHUNK_BYTES = 5 * 1024 * 1024;

/**
 * Hosts video bytes may be fetched from at publish time. Defence-in-depth so
 * the publish path can never be steered at an arbitrary URL — mirrors the
 * LinkedIn analog (Cloudinary + Supabase storage, generated videos live in the
 * `generated-videos` bucket).
 */
const ALLOWED_VIDEO_MEDIA_HOSTS = ['res.cloudinary.com'];
const ALLOWED_VIDEO_MEDIA_HOST_SUFFIX = '.supabase.co';

/** File extensions treated as native video for X publishing. */
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm'];

/** True when a publish-time video URL is https on an allowed media host. */
export function isAllowedTwitterVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (ALLOWED_VIDEO_MEDIA_HOSTS.includes(parsed.hostname) ||
        parsed.hostname.endsWith(ALLOWED_VIDEO_MEDIA_HOST_SUFFIX))
    );
  } catch {
    return false;
  }
}

/** True when a media URL points at a video file (by extension). */
export function isTwitterVideoMediaUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return VIDEO_EXTENSIONS.some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

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

/** Tweet post result */
export interface TweetPostResult {
  success: boolean;
  data: { id: string; text: string };
  id: string;
  text: string;
}

/** Tweet data for posting */
interface TweetData {
  text: string;
  media?: { media_ids: string[] };
  reply?: { in_reply_to_tweet_id: string };
}

/** Twitter API v2 client interface */
interface TwitterV2Client {
  tweet: (data: TweetData) => Promise<{ data: { id: string; text: string } }>;
  singleTweet: (
    id: string,
    options: Record<string, unknown>
  ) => Promise<{
    data: {
      public_metrics?: {
        like_count: number;
        retweet_count: number;
        reply_count: number;
      };
      organic_metrics?: {
        impression_count?: number;
        user_profile_clicks?: number;
        url_link_clicks?: number;
      };
    };
  }>;
  userByUsername: (username: string) => Promise<{ data?: { id: string } }>;
  userTimeline: (
    userId: string,
    options: Record<string, unknown>
  ) => Promise<{ data?: unknown[] }>;
  search: (
    query: string,
    options: Record<string, unknown>
  ) => Promise<{ data?: unknown[] }>;
  deleteTweet: (id: string) => Promise<void>;
}

/** Per-request options for the low-level v1 client (the public typed args omit
 * `prefix`, which the chunked-upload flow needs to target `upload.x.com`). */
interface TwitterV1RequestOptions {
  prefix?: string;
  forceBodyMode?: string;
}

/** Low-level, OAuth1-signed v1 HTTP surface used by the chunked video upload. */
interface TwitterV1UploadClient {
  post: <T = unknown>(
    url: string,
    body?: Record<string, unknown>,
    options?: TwitterV1RequestOptions
  ) => Promise<T>;
  get: <T = unknown>(
    url: string,
    query?: Record<string, unknown>,
    options?: TwitterV1RequestOptions
  ) => Promise<T>;
}

/** X media/upload async transcode state. */
interface TwitterMediaProcessingInfo {
  state: 'pending' | 'in_progress' | 'failed' | 'succeeded';
  check_after_secs?: number;
  progress_percent?: number;
  error?: { code?: number; name?: string; message?: string };
}

/** X media/upload response (INIT/FINALIZE/STATUS all return this shape). */
interface TwitterMediaUploadResult {
  media_id_string: string;
  processing_info?: TwitterMediaProcessingInfo;
}

export class TwitterService {
  private client: TwitterApi | null = null;
  private v2Client: TwitterV2Client | null = null;

  /** Bounded video-processing poll: 60 × 5s ≈ 5 minutes. */
  protected videoPollAttempts = 60;
  protected videoPollIntervalMs = 5000;

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
      this.v2Client = this.client.v2 as unknown as TwitterV2Client;
    } else if (bearerToken) {
      // App-only authentication (for reading)
      this.client = new TwitterApi(bearerToken);
      this.v2Client = this.client.v2 as unknown as TwitterV2Client;
    } else {
      console.warn(
        'Twitter API credentials not configured. Social posting features will be limited.'
      );
    }
  }

  /**
   * Post a single tweet
   */
  async postTweet(post: TwitterPost): Promise<TweetPostResult> {
    if (!this.v2Client) {
      throw new Error(
        'Twitter API not configured. Please set Twitter credentials.'
      );
    }

    try {
      const tweetData: TweetData = {
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
      throw new Error(
        `Failed to post tweet: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create a post — conforms to the BasePlatformService `createPost` contract
   * so TwitterService is interchangeable with the other platform services
   * (IG/LinkedIn/Threads/…) at the base-contract boundary.
   *
   * Delegates to the existing `postTweet` path: public `mediaUrls` are uploaded
   * via `uploadMedia`, then the tweet is posted. Unlike `postTweet`, this never
   * throws — failures are returned as `{ success: false, error }` to match the
   * non-throwing `PostResult` contract.
   */
  async createPost(content: PostContent): Promise<PostResult> {
    try {
      const mediaUrls = content.mediaUrls ?? [];
      const videoUrls = mediaUrls.filter(isTwitterVideoMediaUrl);

      const mediaIds: string[] = [];
      if (videoUrls.length > 0) {
        // A tweet carries exactly one video and never mixes video with images —
        // fail loud rather than silently dropping approved creative (mirrors the
        // LinkedIn analog).
        if (videoUrls.length !== mediaUrls.length) {
          return {
            success: false,
            error:
              'X post cannot mix video and image media — post one video, or images only.',
          };
        }
        if (videoUrls.length > 1) {
          return {
            success: false,
            error: `X allows exactly one video per tweet — ${videoUrls.length} were supplied.`,
          };
        }

        const videoUrl = videoUrls[0];
        if (!isAllowedTwitterVideoUrl(videoUrl)) {
          return {
            success: false,
            error: `X video upload blocked for non-allowlisted media URL: ${videoUrl}`,
          };
        }

        mediaIds.push(await this.uploadVideoAsset(videoUrl));
      } else if (mediaUrls.length > 0) {
        for (const mediaUrl of mediaUrls.slice(0, 4)) {
          mediaIds.push(await this.uploadMedia(mediaUrl));
        }
      }

      const result = await this.postTweet({
        text: content.text,
        mediaIds: mediaIds.length > 0 ? mediaIds : undefined,
      });

      return {
        success: true,
        postId: result.id,
        url: `https://twitter.com/i/web/status/${result.id}`,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Post a thread of tweets
   */
  async postThread(thread: TwitterThread): Promise<TweetPostResult[]> {
    if (!this.v2Client) {
      throw new Error('Twitter API not configured');
    }

    const results: TweetPostResult[] = [];
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
      throw new Error(
        `Failed to upload media: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Upload one video to X via the chunked media-upload flow and return its
   * media_id. Unlike images, X transcodes video asynchronously, so the flow is
   * INIT → APPEND (base64 chunks ≤5MB) → FINALIZE → poll STATUS until
   * processing_info.state === 'succeeded'. Publishing a still-processing media
   * yields a tweet with a broken player, so the STATUS gate is load-bearing.
   * Throws PlatformError on any failure so createPost reports it instead of
   * posting videoless.
   */
  async uploadVideoAsset(videoUrl: string): Promise<string> {
    if (!this.client) {
      throw new PlatformError('twitter', 'Twitter API not configured');
    }
    const v1 = this.client.v1 as unknown as TwitterV1UploadClient;

    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new PlatformError(
        'twitter',
        `Failed to fetch video bytes (${videoResponse.status}) from ${videoUrl}`
      );
    }
    const bytes = Buffer.from(await videoResponse.arrayBuffer());
    const mediaType = videoResponse.headers.get('content-type') ?? 'video/mp4';

    // INIT — declare a tweet_video of the given size + type.
    const init = await v1.post<TwitterMediaUploadResult>(
      'media/upload.json',
      {
        command: 'INIT',
        total_bytes: bytes.byteLength,
        media_type: mediaType,
        media_category: 'tweet_video',
      },
      { prefix: TWITTER_UPLOAD_PREFIX }
    );
    const mediaId = init.media_id_string;
    if (!mediaId) {
      throw new PlatformError('twitter', 'INIT returned no media_id');
    }

    // APPEND — upload the bytes as sequential base64 chunks (≤5MB each).
    let segmentIndex = 0;
    for (
      let offset = 0;
      offset < bytes.byteLength;
      offset += TWITTER_VIDEO_CHUNK_BYTES
    ) {
      const chunk = bytes.subarray(offset, offset + TWITTER_VIDEO_CHUNK_BYTES);
      await v1.post(
        'media/upload.json',
        {
          command: 'APPEND',
          media_id: mediaId,
          segment_index: segmentIndex,
          media_data: chunk.toString('base64'),
        },
        { prefix: TWITTER_UPLOAD_PREFIX }
      );
      segmentIndex += 1;
    }

    // FINALIZE — kicks off async transcode; may return processing_info.
    const finalize = await v1.post<TwitterMediaUploadResult>(
      'media/upload.json',
      { command: 'FINALIZE', media_id: mediaId },
      { prefix: TWITTER_UPLOAD_PREFIX }
    );

    await this.waitForVideoProcessing(mediaId, finalize, videoUrl);
    return mediaId;
  }

  /**
   * Poll GET media/upload?command=STATUS until processing_info.state reports
   * 'succeeded'. Bounded — a stuck or failed transcode fails the post loudly
   * with X's own error rather than publishing an unplayable tweet. A FINALIZE
   * that already reports success (or omits processing_info) needs no poll.
   */
  private async waitForVideoProcessing(
    mediaId: string,
    finalize: TwitterMediaUploadResult,
    videoUrl: string
  ): Promise<void> {
    if (!this.client) {
      throw new PlatformError('twitter', 'Twitter API not configured');
    }
    const v1 = this.client.v1 as unknown as TwitterV1UploadClient;

    let info = finalize.processing_info;
    if (!info || info.state === 'succeeded') {
      return;
    }

    for (let attempt = 0; attempt < this.videoPollAttempts; attempt++) {
      await new Promise(resolve =>
        setTimeout(resolve, this.videoPollIntervalMs)
      );

      const status = await v1.get<TwitterMediaUploadResult>(
        'media/upload.json',
        { command: 'STATUS', media_id: mediaId },
        { prefix: TWITTER_UPLOAD_PREFIX }
      );
      info = status.processing_info;

      if (!info || info.state === 'succeeded') {
        return;
      }
      if (info.state === 'failed') {
        const reason = info.error?.message ?? info.error?.name ?? 'failed';
        throw new PlatformError(
          'twitter',
          `Video processing failed (${reason}) for ${videoUrl}`
        );
      }
    }

    throw new PlatformError(
      'twitter',
      `Video did not succeed within ${this.videoPollAttempts} STATUS polls (last state: ${info?.state ?? 'unknown'}) for ${videoUrl}`
    );
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
        'tweet.fields': [
          'public_metrics',
          'organic_metrics',
          'promoted_metrics',
        ],
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
  async getUserTimeline(
    username: string,
    maxResults: number = 10
  ): Promise<unknown[]> {
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
      throw new Error(
        `Failed to get timeline: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Search tweets
   */
  async searchTweets(
    query: string,
    maxResults: number = 10
  ): Promise<unknown[]> {
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
      throw new Error(
        `Failed to search tweets: ${error instanceof Error ? error.message : String(error)}`
      );
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
      throw new Error(
        `Failed to delete tweet: ${error instanceof Error ? error.message : String(error)}`
      );
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
      message:
        'Tweet scheduled successfully (requires job queue implementation)',
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
      return {
        valid: false,
        error: `Tweet is ${text.length} characters (max 280)`,
      };
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
      return tweets.map(
        (tweet, index) => `${index + 1}/${tweets.length} ${tweet}`
      );
    }

    return tweets;
  }
}

// Export singleton instance
export const twitterService = new TwitterService();
