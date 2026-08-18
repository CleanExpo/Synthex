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
  EngagementMetrics,
  ProfileScore,
  ProfilePlatform,
} from './types';

// ---------------------------------------------------------------------------
// Actor IDs
// ---------------------------------------------------------------------------

const ACTOR_IDS: Record<ProfilePlatform, string> = {
  linkedin: 'dev_fusion/linkedin-profile-scraper',
  facebook: 'apify/facebook-pages-scraper',
};

// ---------------------------------------------------------------------------
// Raw shapes returned by Apify actors
// ---------------------------------------------------------------------------

interface RawLinkedInPost {
  text?: string;
  totalReactionCount?: number;
  commentsCount?: number;
  repostsCount?: number;
  postedAt?: string;
  type?: string;
}

interface RawLinkedInProfile {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  headline?: string;
  followersCount?: number;
  connectionsCount?: number;
  posts?: RawLinkedInPost[];
}

interface RawFacebookPost {
  text?: string;
  likes?: number;
  likesCount?: number;
  comments?: number;
  commentsCount?: number;
  shares?: number;
  sharesCount?: number;
  date?: string;
  postDate?: string;
  type?: string;
}

interface RawFacebookPage {
  name?: string;
  title?: string;
  likes?: number;
  followers?: number;
  posts?: RawFacebookPost[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function engagementRate(avgInteractions: number, followers: number): number {
  if (!followers) return 0;
  return Math.min(
    100,
    parseFloat(((avgInteractions / followers) * 100).toFixed(2))
  );
}

function scoreComponent(value: number, max: number): number {
  return Math.min(100, Math.round((value / max) * 100));
}

function buildRecommendations(
  platform: ProfilePlatform,
  score: ProfileScore,
  content: ContentInsights,
  followers: number
): string[] {
  const recs: string[] = [];

  if (score.profileCompleteness < 70) {
    recs.push(
      platform === 'linkedin'
        ? 'Complete your LinkedIn headline, summary, and featured section to boost profile views.'
        : 'Add a complete About section, contact info, and cover photo to your Facebook page.'
    );
  }
  if (score.audienceEngagement < 50) {
    recs.push(
      'End each post with a direct question to drive comments — comments signal the algorithm more than likes.'
    );
  }
  if (content.contentMix.video < 20) {
    recs.push(
      'Add short-form video (under 60 s) — video posts consistently outperform text/image by 3–5×.'
    );
  }
  if (content.primaryTopics.length < 3) {
    recs.push(
      'Diversify your content pillars to 3–5 distinct topics so the algorithm serves you to broader audiences.'
    );
  }
  if (followers < 1000) {
    recs.push(
      'Focus on consistent daily engagement with target accounts before increasing posting frequency.'
    );
  }
  if (content.recommendedHashtags.length) {
    recs.push(
      `Use these hashtags in upcoming posts: ${content.recommendedHashtags.slice(0, 5).join(', ')}.`
    );
  }
  if (score.contentConsistency < 60) {
    recs.push(
      'Post on a fixed schedule (same days/times each week) — consistency outperforms frequency.'
    );
  }

  return recs.slice(0, 6);
}

// ---------------------------------------------------------------------------
// LinkedIn
// ---------------------------------------------------------------------------

async function analyseLinkedIn(
  profileUrl: string
): Promise<ProfileAnalysisResult> {
  const raw = await runActor<RawLinkedInProfile>(ACTOR_IDS.linkedin, {
    profileUrls: [profileUrl],
    maxDelay: 5,
  });

  const profile = raw[0];
  if (!profile)
    throw new Error('LinkedIn scrape returned no data for that profile URL.');

  const posts: RawLinkedInPost[] = profile.posts ?? [];
  const followers = profile.followersCount ?? 0;
  const connections = profile.connectionsCount;

  const likes = posts.map(p => p.totalReactionCount ?? 0);
  const comments = posts.map(p => p.commentsCount ?? 0);
  const shares = posts.map(p => p.repostsCount ?? 0);

  const avgLikes = avg(likes);
  const avgComments = avg(comments);
  const avgShares = avg(shares);
  const avgInteractions = avgLikes + avgComments + avgShares;

  const types = posts.map(p => (p.type ?? 'text').toLowerCase());
  const typeCounts = { text: 0, image: 0, video: 0, link: 0 };
  types.forEach(t => {
    if (t.includes('video')) typeCounts.video++;
    else if (t.includes('image') || t.includes('article')) typeCounts.image++;
    else if (t.includes('link') || t.includes('url')) typeCounts.link++;
    else typeCounts.text++;
  });
  const total = posts.length || 1;
  const contentMix = {
    text: Math.round((typeCounts.text / total) * 100),
    image: Math.round((typeCounts.image / total) * 100),
    video: Math.round((typeCounts.video / total) * 100),
    link: Math.round((typeCounts.link / total) * 100),
  };

  const engagement: EngagementMetrics = {
    averageLikes: avgLikes,
    averageComments: avgComments,
    averageShares: avgShares,
    engagementRate: engagementRate(avgInteractions, followers),
    topPostType: Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0],
  };

  const content: ContentInsights = {
    postingFrequency:
      posts.length >= 20
        ? '4–5 times/week'
        : posts.length >= 10
          ? '2–3 times/week'
          : '1 time/week or less',
    primaryTopics: [], // would need NLP — placeholder
    contentMix,
    bestPostingTime: 'Tuesday–Thursday, 8–10 AM local time',
    recommendedHashtags: [
      '#LinkedInMarketing',
      '#ContentStrategy',
      '#B2B',
      '#PersonalBrand',
      '#ProfessionalGrowth',
    ],
  };

  const score: ProfileScore = {
    profileCompleteness: profile.headline ? 85 : 55,
    contentConsistency: scoreComponent(posts.length, 30),
    audienceEngagement: scoreComponent(engagement.engagementRate * 10, 100),
    growthVelocity: scoreComponent(followers, 10000),
    overall: 0,
  };
  score.overall = Math.round(
    (score.profileCompleteness +
      score.contentConsistency +
      score.audienceEngagement +
      score.growthVelocity) /
      4
  );

  const recentPosts = posts.slice(0, 10).map(p => ({
    text: (p.text ?? '').slice(0, 200),
    likes: p.totalReactionCount ?? 0,
    comments: p.commentsCount ?? 0,
    postedAt: p.postedAt ?? '',
  }));

  return {
    platform: 'linkedin',
    profileUrl,
    scrapedAt: new Date().toISOString(),
    displayName:
      profile.fullName ??
      `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim(),
    headline: profile.headline,
    followersCount: followers,
    connectionsCount: connections,
    postsAnalysed: posts.length,
    score,
    engagement,
    content,
    recommendations: buildRecommendations(
      'linkedin',
      score,
      content,
      followers
    ),
    recentPosts,
  };
}

// ---------------------------------------------------------------------------
// Facebook
// ---------------------------------------------------------------------------

async function analyseFacebook(
  profileUrl: string
): Promise<ProfileAnalysisResult> {
  const raw = await runActor<RawFacebookPage>(ACTOR_IDS.facebook, {
    startUrls: [{ url: profileUrl }],
    maxPosts: 30,
    maxPostDate: '',
  });

  const page = raw[0];
  if (!page)
    throw new Error('Facebook scrape returned no data for that page URL.');

  const posts: RawFacebookPost[] = page.posts ?? [];
  const followers = page.followers ?? page.likes ?? 0;

  const likes = posts.map(p => p.likes ?? p.likesCount ?? 0);
  const comments = posts.map(p => p.comments ?? p.commentsCount ?? 0);
  const shares = posts.map(p => p.shares ?? p.sharesCount ?? 0);

  const avgLikes = avg(likes);
  const avgComments = avg(comments);
  const avgShares = avg(shares);
  const avgInteractions = avgLikes + avgComments + avgShares;

  const types = posts.map(p => (p.type ?? 'text').toLowerCase());
  const typeCounts = { text: 0, image: 0, video: 0, link: 0 };
  types.forEach(t => {
    if (t.includes('video') || t.includes('reel')) typeCounts.video++;
    else if (t.includes('photo') || t.includes('image')) typeCounts.image++;
    else if (t.includes('link') || t.includes('share')) typeCounts.link++;
    else typeCounts.text++;
  });
  const total = posts.length || 1;
  const contentMix = {
    text: Math.round((typeCounts.text / total) * 100),
    image: Math.round((typeCounts.image / total) * 100),
    video: Math.round((typeCounts.video / total) * 100),
    link: Math.round((typeCounts.link / total) * 100),
  };

  const engagement: EngagementMetrics = {
    averageLikes: avgLikes,
    averageComments: avgComments,
    averageShares: avgShares,
    engagementRate: engagementRate(avgInteractions, followers),
    topPostType: Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0],
  };

  const content: ContentInsights = {
    postingFrequency:
      posts.length >= 20
        ? '4–5 times/week'
        : posts.length >= 10
          ? '2–3 times/week'
          : '1 time/week or less',
    primaryTopics: [],
    contentMix,
    bestPostingTime: 'Wednesday–Friday, 1–3 PM local time',
    recommendedHashtags: [
      '#FacebookMarketing',
      '#SmallBusiness',
      '#LocalBusiness',
      '#ContentCreator',
      '#SocialMediaTips',
    ],
  };

  const score: ProfileScore = {
    profileCompleteness: page.name ? 75 : 50,
    contentConsistency: scoreComponent(posts.length, 30),
    audienceEngagement: scoreComponent(engagement.engagementRate * 10, 100),
    growthVelocity: scoreComponent(followers, 10000),
    overall: 0,
  };
  score.overall = Math.round(
    (score.profileCompleteness +
      score.contentConsistency +
      score.audienceEngagement +
      score.growthVelocity) /
      4
  );

  const recentPosts = posts.slice(0, 10).map(p => ({
    text: (p.text ?? '').slice(0, 200),
    likes: p.likes ?? p.likesCount ?? 0,
    comments: p.comments ?? p.commentsCount ?? 0,
    postedAt: p.date ?? p.postDate ?? '',
  }));

  return {
    platform: 'facebook',
    profileUrl,
    scrapedAt: new Date().toISOString(),
    displayName: page.name ?? page.title ?? 'Unknown Page',
    followersCount: followers,
    postsAnalysed: posts.length,
    score,
    engagement,
    content,
    recommendations: buildRecommendations(
      'facebook',
      score,
      content,
      followers
    ),
    recentPosts,
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function analyseProfile(
  req: ProfileAnalysisRequest
): Promise<ProfileAnalysisResult> {
  if (!process.env.APIFY_API_TOKEN) {
    throw new Error('APIFY_API_TOKEN is not configured.');
  }

  logger.info('[profile-analyser] starting', {
    platform: req.platform,
    url: req.profileUrl,
  });

  const result =
    req.platform === 'linkedin'
      ? await analyseLinkedIn(req.profileUrl)
      : await analyseFacebook(req.profileUrl);

  logger.info('[profile-analyser] complete', {
    platform: req.platform,
    score: result.score.overall,
    posts: result.postsAnalysed,
  });

  return result;
}
