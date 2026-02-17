/**
 * Competitor Metrics Fetcher
 *
 * @description Lightweight public profile lookup for tracked competitors.
 * Fetches follower counts, engagement rates, and post metrics from platform APIs.
 *
 * Supported platforms (real API calls):
 * - Twitter: User lookup by username (requires Bearer token)
 * - Instagram: Business Discovery API (requires user's IG Business account token)
 * - YouTube: Channels API (requires API key or OAuth token)
 * - Facebook: Page lookup (requires Page Public Content Access token)
 * - Reddit: Public user about endpoint (no auth needed)
 *
 * Unsupported platforms (graceful failure):
 * - LinkedIn: No public profile lookup API
 * - TikTok: No public profile lookup via Content API
 * - Pinterest: No public profile API for other users
 * - Threads: Requires knowing user's Threads ID (not discoverable by handle)
 *
 * DESIGN: Never throws. Always returns CompetitorMetrics with success flag.
 * DESIGN: Does NOT import or instantiate full platform services.
 */

import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface CompetitorMetrics {
  platform: string;
  handle: string;
  followersCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  engagementRate: number | null;
  fetchedAt: Date;
  success: boolean;
  error?: string;
}

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Fetch public profile metrics for a competitor on a given platform.
 *
 * @param platform - Platform identifier (twitter, instagram, youtube, etc.)
 * @param handle - The competitor's handle/username on that platform
 * @param accessToken - The Synthex user's access token for the platform (null if unavailable)
 * @returns CompetitorMetrics with success flag — never throws
 */
export async function fetchCompetitorMetrics(
  platform: string,
  handle: string,
  accessToken: string | null
): Promise<CompetitorMetrics> {
  const base: CompetitorMetrics = {
    platform,
    handle,
    followersCount: null,
    followingCount: null,
    postsCount: null,
    engagementRate: null,
    fetchedAt: new Date(),
    success: false,
  };

  try {
    switch (platform) {
      case 'twitter':
        return await fetchTwitterMetrics(handle, accessToken, base);
      case 'instagram':
        return await fetchInstagramMetrics(handle, accessToken, base);
      case 'youtube':
        return await fetchYouTubeMetrics(handle, accessToken, base);
      case 'facebook':
        return await fetchFacebookMetrics(handle, accessToken, base);
      case 'reddit':
        return await fetchRedditMetrics(handle, base);
      case 'linkedin':
      case 'tiktok':
      case 'pinterest':
      case 'threads':
        return {
          ...base,
          error: `Platform '${platform}' does not support public profile lookup`,
        };
      default:
        return {
          ...base,
          error: `Unknown platform: ${platform}`,
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[competitor-fetcher] Unexpected error for ${platform}/${handle}`, { error: message });
    return {
      ...base,
      error: `Unexpected error: ${message}`,
    };
  }
}

// ============================================================================
// Twitter
// ============================================================================

async function fetchTwitterMetrics(
  handle: string,
  accessToken: string | null,
  base: CompetitorMetrics
): Promise<CompetitorMetrics> {
  if (!accessToken) {
    return { ...base, error: 'No access token available for Twitter lookup' };
  }

  try {
    const url = `https://api.twitter.com/2/users/by/username/${encodeURIComponent(handle)}?user.fields=public_metrics,description`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
    if (!data.data) {
      return { ...base, error: 'Twitter user not found' };
    }

    const metrics = data.data.public_metrics;
    return {
      ...base,
      followersCount: metrics?.followers_count ?? null,
      followingCount: metrics?.following_count ?? null,
      postsCount: metrics?.tweet_count ?? null,
      engagementRate: null, // Twitter does not expose engagement rate in public metrics
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[competitor-fetcher] Twitter fetch failed for ${handle}`, { error: message });
    return { ...base, error: `Twitter fetch failed: ${message}` };
  }
}

// ============================================================================
// Instagram (Business Discovery API)
// ============================================================================

async function fetchInstagramMetrics(
  handle: string,
  accessToken: string | null,
  base: CompetitorMetrics
): Promise<CompetitorMetrics> {
  if (!accessToken) {
    return { ...base, error: 'No access token available for Instagram lookup' };
  }

  try {
    // First get the user's own IG user ID (needed for Business Discovery)
    const meUrl = `https://graph.facebook.com/v18.0/me?fields=id&access_token=${accessToken}`;
    const meResponse = await fetch(meUrl);

    if (!meResponse.ok) {
      const status = meResponse.status;
      if (status === 401 || status === 190) {
        return { ...base, error: 'Instagram access token expired or invalid' };
      }
      return { ...base, error: `Instagram /me API returned ${status}` };
    }

    const meData = await meResponse.json();
    const igUserId = meData.id;

    if (!igUserId) {
      return { ...base, error: 'Could not resolve Instagram user ID' };
    }

    // Business Discovery API to look up competitor
    const discoveryFields = 'username,name,biography,followers_count,follows_count,media_count';
    const discoveryUrl = `https://graph.facebook.com/v18.0/${igUserId}?fields=business_discovery.fields(${discoveryFields}).username(${encodeURIComponent(handle)})&access_token=${accessToken}`;
    const response = await fetch(discoveryUrl);

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return { ...base, error: 'Instagram API rate limited' };
      }
      return { ...base, error: `Instagram Business Discovery API returned ${status}` };
    }

    const data = await response.json();
    const discovery = data.business_discovery;

    if (!discovery) {
      return { ...base, error: 'Instagram user not found or not a Business/Creator account' };
    }

    return {
      ...base,
      followersCount: discovery.followers_count ?? null,
      followingCount: discovery.follows_count ?? null,
      postsCount: discovery.media_count ?? null,
      engagementRate: null, // Business Discovery does not return engagement rate
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[competitor-fetcher] Instagram fetch failed for ${handle}`, { error: message });
    return { ...base, error: `Instagram fetch failed: ${message}` };
  }
}

// ============================================================================
// YouTube (Channels API)
// ============================================================================

async function fetchYouTubeMetrics(
  handle: string,
  accessToken: string | null,
  base: CompetitorMetrics
): Promise<CompetitorMetrics> {
  // YouTube can use API key or OAuth token
  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;

  if (!accessToken && !apiKey) {
    return { ...base, error: 'No access token or API key available for YouTube lookup' };
  }

  try {
    // Try forHandle first (modern YouTube handles like @username)
    const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
    let url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&forHandle=${encodeURIComponent(cleanHandle)}`;

    if (accessToken) {
      url += `&access_token=${accessToken}`;
    } else if (apiKey) {
      url += `&key=${apiKey}`;
    }

    let response = await fetch(url);

    // If forHandle didn't work, try forUsername (legacy)
    if (response.ok) {
      const data = await response.json();
      if (!data.items || data.items.length === 0) {
        // Retry with forUsername
        let fallbackUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&forUsername=${encodeURIComponent(cleanHandle)}`;
        if (accessToken) {
          fallbackUrl += `&access_token=${accessToken}`;
        } else if (apiKey) {
          fallbackUrl += `&key=${apiKey}`;
        }
        response = await fetch(fallbackUrl);
      }
    }

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return { ...base, error: 'YouTube API rate limited' };
      }
      if (status === 403) {
        return { ...base, error: 'YouTube API quota exceeded or access denied' };
      }
      return { ...base, error: `YouTube API returned ${status}` };
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      return { ...base, error: 'YouTube channel not found' };
    }

    const stats = data.items[0].statistics;
    return {
      ...base,
      followersCount: stats?.subscriberCount ? parseInt(stats.subscriberCount, 10) : null,
      followingCount: null, // YouTube does not have a "following" concept
      postsCount: stats?.videoCount ? parseInt(stats.videoCount, 10) : null,
      engagementRate: null, // Would need per-video data to calculate
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[competitor-fetcher] YouTube fetch failed for ${handle}`, { error: message });
    return { ...base, error: `YouTube fetch failed: ${message}` };
  }
}

// ============================================================================
// Facebook (Page lookup)
// ============================================================================

async function fetchFacebookMetrics(
  handle: string,
  accessToken: string | null,
  base: CompetitorMetrics
): Promise<CompetitorMetrics> {
  if (!accessToken) {
    return { ...base, error: 'No access token available for Facebook lookup' };
  }

  try {
    const fields = 'followers_count,fan_count,name,about';
    const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(handle)}?fields=${fields}&access_token=${accessToken}`;
    const response = await fetch(url);

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return { ...base, error: 'Facebook API rate limited' };
      }
      if (status === 401 || status === 190) {
        return { ...base, error: 'Facebook access token expired or invalid' };
      }
      if (status === 404) {
        return { ...base, error: 'Facebook page not found' };
      }
      return { ...base, error: `Facebook API returned ${status}` };
    }

    const data = await response.json();

    if (data.error) {
      return { ...base, error: `Facebook API error: ${data.error.message || 'Unknown error'}` };
    }

    // fan_count is the page likes, followers_count is followers
    const followersCount = data.followers_count ?? data.fan_count ?? null;

    return {
      ...base,
      followersCount,
      followingCount: null, // Pages don't have a "following" concept
      postsCount: null, // Not available in basic page info
      engagementRate: null,
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[competitor-fetcher] Facebook fetch failed for ${handle}`, { error: message });
    return { ...base, error: `Facebook fetch failed: ${message}` };
  }
}

// ============================================================================
// Reddit (public endpoint, no auth needed)
// ============================================================================

async function fetchRedditMetrics(
  handle: string,
  base: CompetitorMetrics
): Promise<CompetitorMetrics> {
  try {
    const url = `https://www.reddit.com/user/${encodeURIComponent(handle)}/about.json`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Synthex/1.0 (competitor-tracking)',
      },
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return { ...base, error: 'Reddit API rate limited' };
      }
      if (status === 404) {
        return { ...base, error: 'Reddit user not found' };
      }
      return { ...base, error: `Reddit API returned ${status}` };
    }

    const data = await response.json();
    const userData = data.data;

    if (!userData) {
      return { ...base, error: 'Reddit user data unavailable' };
    }

    // Reddit doesn't have followers in public API, but has karma
    // link_karma + comment_karma serve as an engagement proxy
    const totalKarma = (userData.link_karma || 0) + (userData.comment_karma || 0);

    return {
      ...base,
      followersCount: userData.subreddit?.subscribers ?? null,
      followingCount: null, // Reddit does not expose following count publicly
      postsCount: null, // Not available in about endpoint
      engagementRate: totalKarma > 0 ? totalKarma : null, // Karma as engagement proxy
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[competitor-fetcher] Reddit fetch failed for ${handle}`, { error: message });
    return { ...base, error: `Reddit fetch failed: ${message}` };
  }
}
