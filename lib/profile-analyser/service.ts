/**
 * Profile Analyser Service
 *
 * Scrapes a LinkedIn or Facebook profile via Apify, then derives
 * actionable engagement metrics and content insights.
 *
 * ENVIRONMENT VARIABLES:
 * - APIFY_API_TOKEN (CRITICAL) — Apify token
 */

import { runActor } from '@/lib/auto-research/apify/client';
import { logger } from '@/lib/logger';
import type {
  ProfileAnalysisRequest,
  ProfileAnalysisResult,
  ContentInsights,
  ProfilePlatform,
} from './types';
import { extractHashtags, extractPrimaryTopics } from './topics';
import { validateProfileUrl } from './urls';
import {
  buildEngagement,
  buildRecommendations,
  buildScore,
  contentMixFromTypes,
  inferPostingFrequency,
  profileCompleteness,
} from './scoring';
import {
  normaliseFacebookItems,
  normaliseLinkedInItems,
  type NormalisedProfile,
} from './normalise';

const DEFAULT_HASHTAGS: Record<ProfilePlatform, string[]> = {
  linkedin: [
    '#LinkedInMarketing',
    '#ContentStrategy',
    '#B2B',
    '#PersonalBrand',
    '#ProfessionalGrowth',
  ],
  facebook: [
    '#FacebookMarketing',
    '#SmallBusiness',
    '#LocalBusiness',
    '#ContentCreator',
    '#SocialMediaTips',
  ],
};

const BEST_TIME: Record<ProfilePlatform, string> = {
  linkedin: 'Tuesday–Thursday, 8–10 AM local time',
  facebook: 'Wednesday–Friday, 1–3 PM local time',
};

interface ActorAttempt {
  actorId: string;
  input: Record<string, unknown>;
}

async function runFirstSuccessfulActor(
  attempts: ActorAttempt[]
): Promise<unknown[]> {
  let lastError: Error | undefined;
  for (const attempt of attempts) {
    try {
      const items = await runActor<unknown>(attempt.actorId, attempt.input);
      if (items.length > 0) return items;
      lastError = new Error(`${attempt.actorId} returned no items`);
      logger.warn('[profile-analyser] actor returned empty dataset', {
        actorId: attempt.actorId,
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn('[profile-analyser] actor failed, trying fallback', {
        actorId: attempt.actorId,
        error: lastError.message,
      });
    }
  }
  throw lastError ?? new Error('All Apify actors failed');
}

function toResult(
  platform: ProfilePlatform,
  profileUrl: string,
  profile: NormalisedProfile
): ProfileAnalysisResult {
  const posts = profile.posts;
  const types = posts.map(p => p.type);
  const engagement = buildEngagement(
    posts.map(p => p.likes),
    posts.map(p => p.comments),
    posts.map(p => p.shares),
    profile.followers,
    types
  );

  const texts = posts.map(p => p.text).filter(Boolean);
  const topics = extractPrimaryTopics(texts);
  const hashtags = extractHashtags(texts);
  const content: ContentInsights = {
    postingFrequency: inferPostingFrequency(
      posts.length,
      posts.map(p => p.postedAt)
    ),
    primaryTopics: topics,
    contentMix: contentMixFromTypes(types),
    bestPostingTime: BEST_TIME[platform],
    recommendedHashtags: hashtags.length
      ? hashtags
      : DEFAULT_HASHTAGS[platform],
  };

  const score = buildScore({
    completeness: profileCompleteness({
      hasName: Boolean(profile.displayName),
      hasHeadline: Boolean(profile.headline),
      followers: profile.followers,
      connections: profile.connections,
    }),
    postsAnalysed: posts.length,
    engagementRate: engagement.engagementRate,
    followers: profile.followers,
  });

  return {
    platform,
    profileUrl,
    scrapedAt: new Date().toISOString(),
    displayName: profile.displayName,
    headline: profile.headline,
    followersCount: profile.followers,
    connectionsCount: profile.connections,
    postsAnalysed: posts.length,
    score,
    engagement,
    content,
    recommendations: buildRecommendations(
      platform,
      score,
      content,
      profile.followers
    ),
    recentPosts: posts.slice(0, 10).map(p => ({
      text: p.text.slice(0, 200),
      likes: p.likes,
      comments: p.comments,
      postedAt: p.postedAt,
    })),
  };
}

async function analyseLinkedIn(
  profileUrl: string
): Promise<ProfileAnalysisResult> {
  const attempts: ActorAttempt[] = [
    {
      actorId: 'harvestapi/linkedin-profile-scraper',
      input: {
        queries: [profileUrl],
        profileScraperMode: 'Profile details no email ($4 per 1k)',
      },
    },
    {
      actorId: 'dev_fusion/linkedin-profile-scraper',
      input: {
        profileUrls: [profileUrl],
        maxDelay: 5,
      },
    },
  ];

  let profile: ReturnType<typeof normaliseLinkedInItems> | null = null;

  for (const attempt of attempts) {
    try {
      const items = await runActor<unknown>(attempt.actorId, attempt.input);
      if (!items.length) {
        logger.warn('[profile-analyser] actor returned empty dataset', {
          actorId: attempt.actorId,
        });
        continue;
      }
      const next = normaliseLinkedInItems(items);
      if (!profile) profile = next;
      else if (!profile.posts.length && next.posts.length) {
        // Annotated intermediate: assigning a self-spread straight back into
        // `profile` makes its type circular, so tsc falls back to the declared
        // `| null` and rejects the spread (TS2698).
        const merged: NormalisedProfile = {
          ...profile,
          posts: next.posts,
          followers: profile.followers || next.followers,
          connections: profile.connections || next.connections,
          headline: profile.headline || next.headline,
          displayName:
            profile.displayName !== 'LinkedIn profile'
              ? profile.displayName
              : next.displayName,
        };
        profile = merged;
      }
      if (profile.posts.length) break;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[profile-analyser] actor failed, trying fallback', {
        actorId: attempt.actorId,
        error: message,
      });
    }
  }

  if (!profile || (!profile.displayName && !profile.posts.length)) {
    throw new Error('LinkedIn scrape returned no data for that profile URL.');
  }

  return toResult('linkedin', profileUrl, profile);
}

async function analyseFacebook(
  profileUrl: string
): Promise<ProfileAnalysisResult> {
  const raw = await runFirstSuccessfulActor([
    {
      actorId: 'apify/facebook-posts-scraper',
      input: {
        startUrls: [{ url: profileUrl }],
        maxPosts: 30,
        resultsLimit: 30,
      },
    },
    {
      actorId: 'apify/facebook-pages-scraper',
      input: {
        startUrls: [{ url: profileUrl }],
        maxPosts: 30,
      },
    },
  ]);

  const profile = normaliseFacebookItems(raw);
  if (!profile.displayName && !profile.posts.length) {
    throw new Error('Facebook scrape returned no data for that page URL.');
  }

  return toResult('facebook', profileUrl, profile);
}

export async function analyseProfile(
  req: ProfileAnalysisRequest
): Promise<ProfileAnalysisResult> {
  if (!process.env.APIFY_API_TOKEN?.trim()) {
    throw new Error('APIFY_API_TOKEN is not configured.');
  }

  const validated = validateProfileUrl(req.platform, req.profileUrl);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  logger.info('[profile-analyser] starting', {
    platform: req.platform,
    url: validated.url,
  });

  const result =
    req.platform === 'linkedin'
      ? await analyseLinkedIn(validated.url)
      : await analyseFacebook(validated.url);

  logger.info('[profile-analyser] complete', {
    platform: req.platform,
    score: result.score.overall,
    posts: result.postsAnalysed,
  });

  return result;
}
