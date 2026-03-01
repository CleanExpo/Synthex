/**
 * Competitor Analysis Helpers
 *
 * Utility functions for data loading and transformation.
 */

import type { Competitor, SocialProfile } from './types';

/** Determine company size from follower count */
export function determineSizeFromFollowers(
  followers: number
): 'small' | 'medium' | 'large' | 'enterprise' {
  if (followers >= 1_000_000) return 'enterprise';
  if (followers >= 100_000) return 'large';
  if (followers >= 10_000) return 'medium';
  return 'small';
}

/** Build social profiles from competitor data */
export function buildSocialProfiles(comp: {
  twitterHandle?: string;
  instagramHandle?: string;
  linkedinHandle?: string;
  facebookHandle?: string;
  youtubeHandle?: string;
  tiktokHandle?: string;
}): SocialProfile[] {
  const profiles: SocialProfile[] = [];

  if (comp.twitterHandle) {
    profiles.push({ platform: 'twitter', handle: comp.twitterHandle, url: `twitter.com/${comp.twitterHandle}`, verified: false });
  }
  if (comp.instagramHandle) {
    profiles.push({ platform: 'instagram', handle: comp.instagramHandle, url: `instagram.com/${comp.instagramHandle}`, verified: false });
  }
  if (comp.linkedinHandle) {
    profiles.push({ platform: 'linkedin', handle: comp.linkedinHandle, url: `linkedin.com/company/${comp.linkedinHandle}`, verified: false });
  }
  if (comp.facebookHandle) {
    profiles.push({ platform: 'facebook', handle: comp.facebookHandle, url: `facebook.com/${comp.facebookHandle}`, verified: false });
  }
  if (comp.youtubeHandle) {
    profiles.push({ platform: 'youtube', handle: comp.youtubeHandle, url: `youtube.com/${comp.youtubeHandle}`, verified: false });
  }
  if (comp.tiktokHandle) {
    profiles.push({ platform: 'tiktok', handle: comp.tiktokHandle, url: `tiktok.com/@${comp.tiktokHandle}`, verified: false });
  }

  return profiles;
}

/** Transform tracking API response into Competitor */
export function transformTrackingCompetitor(comp: Record<string, any>): Competitor {
  const snapshot = comp.latestSnapshot || {};

  return {
    id: comp.id,
    name: comp.name,
    domain: comp.domain || '',
    description: comp.description || 'Competitor being tracked',
    industry: comp.industry || 'Unknown',
    size: determineSizeFromFollowers(snapshot.followers || 0),
    metrics: {
      followers: {
        twitter: snapshot.twitterFollowers || 0,
        instagram: snapshot.instagramFollowers || 0,
        linkedin: snapshot.linkedinFollowers || 0,
        facebook: snapshot.facebookFollowers || 0,
        youtube: snapshot.youtubeFollowers || 0,
        tiktok: snapshot.tiktokFollowers || 0,
        total: snapshot.followers || 0,
      },
      engagement: {
        twitter: snapshot.twitterEngagement || 0,
        instagram: snapshot.instagramEngagement || 0,
        linkedin: snapshot.linkedinEngagement || 0,
        facebook: snapshot.facebookEngagement || 0,
        youtube: snapshot.youtubeEngagement || 0,
        tiktok: snapshot.tiktokEngagement || 0,
        total: snapshot.engagementRate || 0,
      },
      postFrequency: {
        twitter: snapshot.twitterPostFreq || 0,
        instagram: snapshot.instagramPostFreq || 0,
        linkedin: snapshot.linkedinPostFreq || 0,
        facebook: snapshot.facebookPostFreq || 0,
        youtube: snapshot.youtubePostFreq || 0,
        tiktok: snapshot.tiktokPostFreq || 0,
        total: snapshot.totalPostFreq || 0,
      },
      growthRate: snapshot.growthRate || 0,
      sentimentScore: snapshot.sentimentScore || 0,
      shareOfVoice: snapshot.shareOfVoice || 0,
      contentPerformance: {
        avgLikes: snapshot.avgLikes || 0,
        avgComments: snapshot.avgComments || 0,
        avgShares: snapshot.avgShares || 0,
        viralPosts: snapshot.viralPosts || 0,
      },
    },
    socialProfiles: buildSocialProfiles(comp),
    contentStrategy: {
      topContent: [],
      postingTimes: snapshot.postingTimes || [],
      contentTypes: snapshot.contentTypes || [],
      hashtagStrategy: comp.tags || [],
      toneOfVoice: snapshot.toneOfVoice || '',
    },
    strengths: snapshot.strengths || [],
    weaknesses: snapshot.weaknesses || [],
    opportunities: snapshot.opportunities || [],
    tracking: comp.isActive !== false,
  };
}

/** Transform intelligence API response into Competitor */
export function transformIntelligenceCompetitor(comp: Record<string, any>): Competitor {
  return {
    id: comp.id,
    name: comp.name,
    domain: comp.website || '',
    description: comp.notes || 'Competitor profile',
    industry: comp.industry || 'Unknown',
    size: 'medium',
    metrics: {
      followers: { total: 0 },
      engagement: { total: 0 },
      postFrequency: { total: 0 },
      growthRate: 0,
      sentimentScore: 0,
      shareOfVoice: 0,
      contentPerformance: { avgLikes: 0, avgComments: 0, avgShares: 0, viralPosts: 0 },
    },
    socialProfiles: [],
    contentStrategy: {
      topContent: [],
      postingTimes: [],
      contentTypes: [],
      hashtagStrategy: [],
      toneOfVoice: '',
    },
    strengths: [],
    weaknesses: [],
    opportunities: [],
    tracking: comp.isActive !== false,
  };
}

/** Create an empty competitor from newly added data */
export function createEmptyCompetitor(data: Record<string, any>, domain: string): Competitor {
  return {
    id: data.competitor.id,
    name: data.competitor.name,
    domain,
    description: 'Analyzing... Tracking will begin shortly.',
    industry: data.competitor.industry || 'Unknown',
    size: 'medium',
    metrics: {
      followers: { total: 0 },
      engagement: { total: 0 },
      postFrequency: { total: 0 },
      growthRate: 0,
      sentimentScore: 0,
      shareOfVoice: 0,
      contentPerformance: { avgLikes: 0, avgComments: 0, avgShares: 0, viralPosts: 0 },
    },
    socialProfiles: [],
    contentStrategy: {
      topContent: [],
      postingTimes: [],
      contentTypes: [],
      hashtagStrategy: [],
      toneOfVoice: '',
    },
    strengths: [],
    weaknesses: [],
    opportunities: [],
    tracking: true,
  };
}
