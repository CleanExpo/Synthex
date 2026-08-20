/**
 * Pure scoring + recommendation helpers for profile analysis.
 */

import type {
  ContentInsights,
  EngagementMetrics,
  ProfilePlatform,
  ProfileScore,
} from './types';

export function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export function engagementRate(
  avgInteractions: number,
  followers: number
): number {
  if (!followers) return 0;
  return Math.min(
    100,
    parseFloat(((avgInteractions / followers) * 100).toFixed(2))
  );
}

export function scoreComponent(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

export function inferPostingFrequency(
  postCount: number,
  postedAt: string[]
): string {
  const dates = postedAt
    .map(d => Date.parse(d))
    .filter(n => Number.isFinite(n))
    .sort((a, b) => a - b);

  if (dates.length >= 2) {
    const spanDays = Math.max(
      1,
      (dates[dates.length - 1] - dates[0]) / 86_400_000
    );
    const perWeek = (dates.length / spanDays) * 7;
    if (perWeek >= 4) return '4–5 times/week';
    if (perWeek >= 2) return '2–3 times/week';
    if (perWeek >= 1) return 'About once a week';
    return 'Less than once a week';
  }

  if (postCount >= 20) return '4–5 times/week';
  if (postCount >= 10) return '2–3 times/week';
  return '1 time/week or less';
}

export function contentMixFromTypes(
  types: Array<'text' | 'image' | 'video' | 'link'>
): ContentInsights['contentMix'] {
  const typeCounts = { text: 0, image: 0, video: 0, link: 0 };
  for (const t of types) typeCounts[t]++;
  const total = types.length || 1;
  return {
    text: Math.round((typeCounts.text / total) * 100),
    image: Math.round((typeCounts.image / total) * 100),
    video: Math.round((typeCounts.video / total) * 100),
    link: Math.round((typeCounts.link / total) * 100),
  };
}

export function topPostType(
  types: Array<'text' | 'image' | 'video' | 'link'>
): string {
  const typeCounts = { text: 0, image: 0, video: 0, link: 0 };
  for (const t of types) typeCounts[t]++;
  return Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0];
}

export function profileCompleteness(hints: {
  hasName: boolean;
  hasHeadline: boolean;
  followers: number;
  connections?: number;
}): number {
  let score = 40;
  if (hints.hasName) score += 20;
  if (hints.hasHeadline) score += 20;
  if (hints.followers > 0) score += 10;
  if ((hints.connections ?? 0) > 0) score += 10;
  return Math.min(100, score);
}

export function buildScore(input: {
  completeness: number;
  postsAnalysed: number;
  engagementRate: number;
  followers: number;
}): ProfileScore {
  const score: ProfileScore = {
    profileCompleteness: input.completeness,
    contentConsistency: scoreComponent(input.postsAnalysed, 30),
    audienceEngagement: scoreComponent(input.engagementRate * 10, 100),
    growthVelocity: scoreComponent(input.followers, 10_000),
    overall: 0,
  };
  score.overall = Math.round(
    (score.profileCompleteness +
      score.contentConsistency +
      score.audienceEngagement +
      score.growthVelocity) /
      4
  );
  return score;
}

export function buildRecommendations(
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

export function buildEngagement(
  likes: number[],
  comments: number[],
  shares: number[],
  followers: number,
  types: Array<'text' | 'image' | 'video' | 'link'>
): EngagementMetrics {
  const avgLikes = avg(likes);
  const avgComments = avg(comments);
  const avgShares = avg(shares);
  return {
    averageLikes: avgLikes,
    averageComments: avgComments,
    averageShares: avgShares,
    engagementRate: engagementRate(
      avgLikes + avgComments + avgShares,
      followers
    ),
    topPostType: types.length ? topPostType(types) : 'text',
  };
}
