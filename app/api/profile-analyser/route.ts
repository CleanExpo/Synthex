/**
 * Profile Analyser API
 *
 * POST /api/profile-analyser
 *
 * Accepts a public social profile URL, detects the platform, runs the
 * appropriate Apify actor, and returns structured profile data.
 *
 * Required env:
 *   APIFY_API_TOKEN — from https://console.apify.com/account/integrations
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApifyClient } from 'apify-client';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Apify actor IDs (public actors on Apify store)
// ---------------------------------------------------------------------------

const ACTORS = {
  instagram: 'apify/instagram-profile-scraper',
  twitter: 'apify/twitter-scraper',
  linkedin: 'apify/linkedin-profile-scraper',
  tiktok: 'apify/tiktok-scraper',
} as const;

export type SupportedPlatform = keyof typeof ACTORS;

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

function detectPlatform(url: string): SupportedPlatform | null {
  if (/instagram\.com/i.test(url)) return 'instagram';
  if (/twitter\.com|x\.com/i.test(url)) return 'twitter';
  if (/linkedin\.com/i.test(url)) return 'linkedin';
  if (/tiktok\.com/i.test(url)) return 'tiktok';
  return null;
}

// ---------------------------------------------------------------------------
// Normalise raw Apify output into a consistent ProfileData shape
// ---------------------------------------------------------------------------

export interface ProfileData {
  platform: SupportedPlatform;
  username: string;
  displayName: string | null;
  bio: string | null;
  followerCount: number;
  followingCount: number;
  postCount: number;
  engagementRate: number | null;
  topHashtags: string[];
  postingFrequencyPerWeek: number | null;
  audienceActivityPatterns:
    | { hour: number; day: string; score: number }[]
    | null;
  avatarUrl: string | null;
  verified: boolean;
  profileUrl: string;
}

function normaliseInstagram(raw: any, url: string): ProfileData {
  return {
    platform: 'instagram',
    username: raw.username ?? raw.userName ?? '',
    displayName: raw.fullName ?? raw.name ?? null,
    bio: raw.biography ?? raw.bio ?? null,
    followerCount: raw.followersCount ?? raw.followers ?? 0,
    followingCount: raw.followsCount ?? raw.following ?? 0,
    postCount: raw.postsCount ?? raw.mediaCount ?? 0,
    engagementRate:
      typeof raw.engagementRate === 'number' ? raw.engagementRate : null,
    topHashtags: Array.isArray(raw.topHashtags)
      ? raw.topHashtags.slice(0, 10)
      : [],
    postingFrequencyPerWeek: null,
    audienceActivityPatterns: null,
    avatarUrl: raw.profilePicUrl ?? raw.profilePicUrlHD ?? null,
    verified: raw.verified ?? false,
    profileUrl: url,
  };
}

function normaliseTwitter(raw: any, url: string): ProfileData {
  return {
    platform: 'twitter',
    username: raw.userName ?? raw.screen_name ?? '',
    displayName: raw.name ?? null,
    bio: raw.description ?? null,
    followerCount: raw.followers ?? raw.followers_count ?? 0,
    followingCount: raw.following ?? raw.friends_count ?? 0,
    postCount: raw.statusesCount ?? raw.statuses_count ?? 0,
    engagementRate: null,
    topHashtags: [],
    postingFrequencyPerWeek: null,
    audienceActivityPatterns: null,
    avatarUrl: raw.profileImageUrl ?? raw.profile_image_url_https ?? null,
    verified: raw.verified ?? raw.isVerified ?? false,
    profileUrl: url,
  };
}

function normaliseLinkedIn(raw: any, url: string): ProfileData {
  return {
    platform: 'linkedin',
    username: raw.publicIdentifier ?? raw.username ?? '',
    displayName:
      (raw.fullName ?? raw.firstName)
        ? `${raw.firstName} ${raw.lastName}`
        : null,
    bio: raw.headline ?? raw.summary ?? null,
    followerCount: raw.followersCount ?? raw.connections ?? 0,
    followingCount: 0,
    postCount: 0,
    engagementRate: null,
    topHashtags: [],
    postingFrequencyPerWeek: null,
    audienceActivityPatterns: null,
    avatarUrl: raw.profilePicture ?? raw.pictureUrl ?? null,
    verified: false,
    profileUrl: url,
  };
}

function normaliseTikTok(raw: any, url: string): ProfileData {
  return {
    platform: 'tiktok',
    username: raw.authorMeta?.name ?? raw.uniqueId ?? '',
    displayName: raw.authorMeta?.nickName ?? raw.nickname ?? null,
    bio: raw.authorMeta?.signature ?? raw.bio ?? null,
    followerCount: raw.authorMeta?.fans ?? raw.followersCount ?? 0,
    followingCount: raw.authorMeta?.following ?? raw.followingCount ?? 0,
    postCount: raw.authorMeta?.video ?? raw.videoCount ?? 0,
    engagementRate: null,
    topHashtags: Array.isArray(raw.hashtags)
      ? raw.hashtags
          .slice(0, 10)
          .map((h: { name?: string } | string) =>
            typeof h === 'string' ? h : (h.name ?? '')
          )
      : [],
    postingFrequencyPerWeek: null,
    audienceActivityPatterns: null,
    avatarUrl: raw.authorMeta?.avatar ?? null,
    verified: raw.authorMeta?.verified ?? false,
    profileUrl: url,
  };
}

function normaliseRaw(
  platform: SupportedPlatform,
  raw: any,
  url: string
): ProfileData {
  switch (platform) {
    case 'instagram':
      return normaliseInstagram(raw, url);
    case 'twitter':
      return normaliseTwitter(raw, url);
    case 'linkedin':
      return normaliseLinkedIn(raw, url);
    case 'tiktok':
      return normaliseTikTok(raw, url);
  }
}

// ---------------------------------------------------------------------------
// Build actor input per platform
// ---------------------------------------------------------------------------

function buildActorInput(
  platform: SupportedPlatform,
  url: string
): Record<string, unknown> {
  switch (platform) {
    case 'instagram':
      return { usernames: [url.split('/').filter(Boolean).pop() ?? url] };
    case 'twitter':
      return {
        startUrls: [{ url }],
        maxItems: 1,
        addUserInfo: true,
        scrapeUserInfo: true,
      };
    case 'linkedin':
      return { profileUrls: [url] };
    case 'tiktok':
      return {
        profiles: [url],
        resultsPerPage: 1,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      };
  }
}

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  url: z.string().url('Must be a valid URL'),
});

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    const rawBody = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { url } = parsed.data;
    const platform = detectPlatform(url);

    if (!platform) {
      return NextResponse.json(
        {
          error:
            'Unsupported platform. Supported: Instagram, Twitter/X, LinkedIn, TikTok.',
        },
        { status: 400 }
      );
    }

    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      logger.error('APIFY_API_TOKEN is not configured');
      return NextResponse.json(
        { error: 'Profile analyser is not configured. Contact support.' },
        { status: 503 }
      );
    }

    const client = new ApifyClient({ token });
    const actorId = ACTORS[platform];
    const input = buildActorInput(platform, url);

    logger.info('Running Apify actor', { actorId, platform, url });

    const run = await client.actor(actorId).call(input, {
      timeout: 120, // seconds — allow up to 2 minutes
      memory: 256,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      return NextResponse.json(
        {
          error:
            'No profile data returned. The profile may be private or the URL incorrect.',
        },
        { status: 404 }
      );
    }

    const profile = normaliseRaw(platform, items[0], url);

    return NextResponse.json({ success: true, profile });
  } catch (err) {
    logger.error('Profile analyser error', { err });
    return NextResponse.json(
      { error: 'Failed to analyse profile. Please try again.' },
      { status: 500 }
    );
  }
}
