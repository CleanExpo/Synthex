/**
 * Social Mention Fetcher
 *
 * @description Fetches brand mentions, keywords, and hashtags from social platforms.
 * Follows the competitor-fetcher.ts pattern: never throws, returns success flags.
 *
 * Supported platforms:
 * - Twitter/X: Search API v2 (requires Bearer token, 7-day window)
 * - YouTube: Comments search API (requires API key)
 * - Reddit: Public search endpoint (no auth needed)
 *
 * Limited platforms:
 * - Instagram: Business Discovery only works for specific accounts
 *
 * DESIGN: Never throws. Always returns array with success flag per mention.
 */

import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface FetchedMention {
  platform: string;
  platformPostId: string;
  platformUrl: string | null;
  authorHandle: string;
  authorName: string | null;
  authorAvatar: string | null;
  authorFollowers: number | null;
  content: string;
  mediaUrls: string[];
  likes: number;
  comments: number;
  shares: number;
  postedAt: Date;
  success: boolean;
  error?: string;
}

export interface FetchMentionsResult {
  mentions: FetchedMention[];
  success: boolean;
  error?: string;
  platform: string;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Fetch mentions containing a keyword from a specific platform.
 *
 * @param keyword - The keyword, hashtag, or brand name to search for
 * @param platform - Platform identifier (twitter, youtube, reddit, etc.)
 * @param accessToken - User's access token for the platform (null if unavailable)
 * @param since - Only fetch mentions after this date
 * @returns FetchMentionsResult with mentions array and success flag
 */
export async function fetchMentions(
  keyword: string,
  platform: string,
  accessToken: string | null,
  since?: Date
): Promise<FetchMentionsResult> {
  const baseResult: FetchMentionsResult = {
    mentions: [],
    success: false,
    platform,
  };

  try {
    switch (platform) {
      case 'twitter':
        return await fetchTwitterMentions(keyword, accessToken, since, baseResult);
      case 'youtube':
        return await fetchYouTubeMentions(keyword, accessToken, since, baseResult);
      case 'reddit':
        return await fetchRedditMentions(keyword, since, baseResult);
      case 'instagram':
        return {
          ...baseResult,
          error: 'Instagram mention search requires Business Discovery API which only works for specific business accounts. Use hashtag tracking instead.',
        };
      case 'tiktok':
      case 'linkedin':
      case 'pinterest':
      case 'threads':
        return {
          ...baseResult,
          error: `Platform '${platform}' does not support public mention search`,
        };
      default:
        return {
          ...baseResult,
          error: `Unknown platform: ${platform}`,
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[mention-fetcher] Unexpected error for ${platform}/${keyword}`, { error: message });
    return {
      ...baseResult,
      error: `Unexpected error: ${message}`,
    };
  }
}

// ============================================================================
// Twitter/X
// ============================================================================

async function fetchTwitterMentions(
  keyword: string,
  accessToken: string | null,
  since: Date | undefined,
  base: FetchMentionsResult
): Promise<FetchMentionsResult> {
  // Use Bearer token from env if no user token
  const token = accessToken || process.env.TWITTER_BEARER_TOKEN;

  if (!token) {
    return { ...base, error: 'No access token or Bearer token available for Twitter' };
  }

  try {
    // Build search query
    const query = encodeURIComponent(`${keyword} -is:retweet`);
    const maxResults = 20;
    const tweetFields = 'created_at,public_metrics,author_id';
    const userFields = 'name,username,profile_image_url,public_metrics';
    const expansions = 'author_id,attachments.media_keys';
    const mediaFields = 'url,preview_image_url';

    let url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=${maxResults}&tweet.fields=${tweetFields}&user.fields=${userFields}&expansions=${expansions}&media.fields=${mediaFields}`;

    if (since) {
      url += `&start_time=${since.toISOString()}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return { ...base, error: 'Twitter API rate limited' };
      }
      if (status === 401) {
        return { ...base, error: 'Twitter access token expired or invalid' };
      }
      return { ...base, error: `Twitter API returned ${status}` };
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return { ...base, mentions: [], success: true };
    }

    // Build user lookup map
    const userMap = new Map<string, { name: string; username: string; avatar: string; followers: number }>();
    if (data.includes?.users) {
      for (const user of data.includes.users) {
        userMap.set(user.id, {
          name: user.name,
          username: user.username,
          avatar: user.profile_image_url || null,
          followers: user.public_metrics?.followers_count || 0,
        });
      }
    }

    // Build media lookup map
    const mediaMap = new Map<string, string>();
    if (data.includes?.media) {
      for (const media of data.includes.media) {
        mediaMap.set(media.media_key, media.url || media.preview_image_url || '');
      }
    }

    const mentions: FetchedMention[] = data.data.map((tweet: Record<string, unknown>) => {
      const user = userMap.get(tweet.author_id as string);
      const mediaKeys = (tweet.attachments as Record<string, unknown>)?.media_keys as string[] || [];
      const mediaUrls = mediaKeys.map(key => mediaMap.get(key)).filter(Boolean) as string[];

      return {
        platform: 'twitter',
        platformPostId: tweet.id as string,
        platformUrl: `https://twitter.com/i/status/${tweet.id}`,
        authorHandle: user?.username || 'unknown',
        authorName: user?.name || null,
        authorAvatar: user?.avatar || null,
        authorFollowers: user?.followers || null,
        content: tweet.text as string,
        mediaUrls,
        likes: (tweet.public_metrics as Record<string, number>)?.like_count || 0,
        comments: (tweet.public_metrics as Record<string, number>)?.reply_count || 0,
        shares: (tweet.public_metrics as Record<string, number>)?.retweet_count || 0,
        postedAt: new Date(tweet.created_at as string),
        success: true,
      };
    });

    return {
      ...base,
      mentions,
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[mention-fetcher] Twitter fetch failed for "${keyword}"`, { error: message });
    return { ...base, error: `Twitter fetch failed: ${message}` };
  }
}

// ============================================================================
// YouTube (Comments Search)
// ============================================================================

async function fetchYouTubeMentions(
  keyword: string,
  accessToken: string | null,
  since: Date | undefined,
  base: FetchMentionsResult
): Promise<FetchMentionsResult> {
  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;

  if (!accessToken && !apiKey) {
    return { ...base, error: 'No access token or API key available for YouTube' };
  }

  try {
    // YouTube comment search using commentThreads with searchTerms
    const maxResults = 20;
    let url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&allThreadsRelatedToChannelId=&searchTerms=${encodeURIComponent(keyword)}&maxResults=${maxResults}&order=time`;

    // Note: searchTerms only works with allThreadsRelatedToChannelId
    // For general search, we use the video search then get comments
    // Fallback: Search videos by keyword and get their comments
    url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=10&order=date`;

    if (accessToken) {
      url += `&access_token=${accessToken}`;
    } else if (apiKey) {
      url += `&key=${apiKey}`;
    }

    if (since) {
      url += `&publishedAfter=${since.toISOString()}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      const status = response.status;
      if (status === 429 || status === 403) {
        return { ...base, error: 'YouTube API quota exceeded or rate limited' };
      }
      return { ...base, error: `YouTube API returned ${status}` };
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return { ...base, mentions: [], success: true };
    }

    // Convert video results to mentions (videos mentioning the keyword)
    const mentions: FetchedMention[] = data.items.map((item: Record<string, unknown>) => {
      const snippet = item.snippet as Record<string, unknown>;
      const thumbnails = snippet.thumbnails as Record<string, Record<string, string>>;

      return {
        platform: 'youtube',
        platformPostId: (item.id as Record<string, string>)?.videoId || item.id as string,
        platformUrl: `https://www.youtube.com/watch?v=${(item.id as Record<string, string>)?.videoId || item.id}`,
        authorHandle: snippet.channelTitle as string,
        authorName: snippet.channelTitle as string,
        authorAvatar: thumbnails?.default?.url || null,
        authorFollowers: null, // Would need separate channel lookup
        content: `${snippet.title as string}\n${snippet.description as string || ''}`,
        mediaUrls: thumbnails?.high?.url ? [thumbnails.high.url] : [],
        likes: 0, // Video stats require separate API call
        comments: 0,
        shares: 0,
        postedAt: new Date(snippet.publishedAt as string),
        success: true,
      };
    });

    return {
      ...base,
      mentions,
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[mention-fetcher] YouTube fetch failed for "${keyword}"`, { error: message });
    return { ...base, error: `YouTube fetch failed: ${message}` };
  }
}

// ============================================================================
// Reddit (Public Search)
// ============================================================================

async function fetchRedditMentions(
  keyword: string,
  since: Date | undefined,
  base: FetchMentionsResult
): Promise<FetchMentionsResult> {
  try {
    // Reddit search endpoint - no auth needed for public search
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=new&limit=25`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Synthex/1.0 (social-listening)',
      },
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return { ...base, error: 'Reddit API rate limited' };
      }
      return { ...base, error: `Reddit API returned ${status}` };
    }

    const data = await response.json();

    if (!data.data?.children || data.data.children.length === 0) {
      return { ...base, mentions: [], success: true };
    }

    const mentions: FetchedMention[] = data.data.children
      .map((child: Record<string, Record<string, unknown>>) => {
        const post = child.data;
        const postedAt = new Date((post.created_utc as number) * 1000);

        // Filter by since date if provided
        if (since && postedAt < since) {
          return null;
        }

        return {
          platform: 'reddit',
          platformPostId: post.id as string,
          platformUrl: `https://reddit.com${post.permalink}`,
          authorHandle: post.author as string,
          authorName: post.author as string,
          authorAvatar: null, // Reddit doesn't expose avatars in search
          authorFollowers: null,
          content: post.title as string + (post.selftext ? `\n${post.selftext}` : ''),
          mediaUrls: post.url && (post.url as string).match(/\.(jpg|jpeg|png|gif)$/i) ? [post.url as string] : [],
          likes: post.ups as number || 0,
          comments: post.num_comments as number || 0,
          shares: 0, // Reddit doesn't have shares
          postedAt,
          success: true,
        };
      })
      .filter(Boolean) as FetchedMention[];

    return {
      ...base,
      mentions,
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[mention-fetcher] Reddit fetch failed for "${keyword}"`, { error: message });
    return { ...base, error: `Reddit fetch failed: ${message}` };
  }
}

// ============================================================================
// Batch fetch across multiple platforms
// ============================================================================

/**
 * Fetch mentions from multiple platforms in parallel.
 *
 * @param keyword - The keyword to search for
 * @param platforms - Array of platform identifiers
 * @param accessTokens - Map of platform to access token
 * @param since - Only fetch mentions after this date
 * @returns Array of FetchMentionsResult, one per platform
 */
export async function fetchMentionsFromPlatforms(
  keyword: string,
  platforms: string[],
  accessTokens: Map<string, string | null>,
  since?: Date
): Promise<FetchMentionsResult[]> {
  const results = await Promise.all(
    platforms.map(platform =>
      fetchMentions(keyword, platform, accessTokens.get(platform) || null, since)
    )
  );

  return results;
}
