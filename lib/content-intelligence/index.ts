/**
 * Content intelligence public API — SYN-631
 *
 * getContentIntelligence(clientId) is the single entry point for all callers
 * (Auto-Calendar generator, Weekly Digest, Health Score integration).
 *
 * Returns a BlendedContentIntelligence that merges the org's own
 * ContentPerformanceProfile with the IndustryBaseline, weighted by confidenceLevel.
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { blendProfiles } from './blend';
import type {
  BlendedContentIntelligence,
  ContentFormatScores,
  ContentProfile,
  OptimalTimes,
  TopicScore,
} from './types';

/** Empty profile returned when no data is available */
const EMPTY_PROFILE: ContentProfile = {
  topTopics: [],
  optimalTimes: {},
  winningHashtags: [],
  contentFormatScores: { video: 0, image: 0, carousel: 0, text: 0 },
};

/**
 * Returns the blended content intelligence for the given organisation.
 * Safe to call in any context — returns empty profile with 0.0 confidence
 * if the org has no profile or baseline yet.
 */
export async function getContentIntelligence(
  organisationId: string
): Promise<BlendedContentIntelligence> {
  try {
    const profile = await prisma.contentPerformanceProfile.findUnique({
      where: { organizationId: organisationId },
      include: { industryBaseline: true },
    });

    const industry = profile?.industryBaseline?.industry ?? 'general';
    const postCount = profile?.postCount ?? 0;

    const orgProfile: ContentProfile = profile
      ? {
          topTopics: (profile.topTopics as TopicScore[] | null) ?? [],
          optimalTimes: (profile.optimalTimes as OptimalTimes | null) ?? {},
          winningHashtags: (profile.winningHashtags as string[] | null) ?? [],
          contentFormatScores: (profile.contentFormatScores as ContentFormatScores | null) ?? {
            video: 0, image: 0, carousel: 0, text: 0,
          },
        }
      : EMPTY_PROFILE;

    // Try to get a baseline — fall back to empty if none
    let baseline: ContentProfile = EMPTY_PROFILE;
    if (profile?.industryBaseline) {
      const b = profile.industryBaseline;
      baseline = {
        topTopics: (b.topTopics as TopicScore[] | null) ?? [],
        optimalTimes: (b.optimalTimes as OptimalTimes | null) ?? {},
        winningHashtags: (b.winningHashtags as string[] | null) ?? [],
        contentFormatScores: (b.contentFormatScores as ContentFormatScores | null) ?? {
          video: 0, image: 0, carousel: 0, text: 0,
        },
      };
    } else if (!profile) {
      // No profile at all — look up baseline directly by org industry
      const org = await prisma.organization.findUnique({
        where: { id: organisationId },
        select: { industry: true },
      });
      if (org?.industry) {
        const b = await prisma.industryBaseline.findUnique({
          where: { industry: org.industry },
        });
        if (b) {
          baseline = {
            topTopics: (b.topTopics as TopicScore[] | null) ?? [],
            optimalTimes: (b.optimalTimes as OptimalTimes | null) ?? {},
            winningHashtags: (b.winningHashtags as string[] | null) ?? [],
            contentFormatScores: (b.contentFormatScores as ContentFormatScores | null) ?? {
              video: 0, image: 0, carousel: 0, text: 0,
            },
          };
        }
      }
    }

    return blendProfiles({ orgProfile, baseline, postCount, industry });
  } catch (err) {
    logger.warn('getContentIntelligence: failed, returning empty profile', {
      organisationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return blendProfiles({
      orgProfile: EMPTY_PROFILE,
      baseline: EMPTY_PROFILE,
      postCount: 0,
      industry: 'general',
    });
  }
}

export type { BlendedContentIntelligence } from './types';
