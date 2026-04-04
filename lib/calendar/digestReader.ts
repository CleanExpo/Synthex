/**
 * digestReader — lib/calendar/digestReader.ts
 *
 * Reads the last N AIWeeklyDigest records for an organisation and
 * derives the signals needed to generate a content calendar:
 *   - digestCount  (used for cold-start gate)
 *   - topContentTypes
 *   - peakEngagementHours
 *   - winningHashtags
 *   - activePlatforms
 *
 * Signal sources (in priority order):
 *  1. Published Post.hashtags + Post.platform → winning hashtags + active platforms
 *  2. PlatformPost.publishedAt hour histogram → peak hours
 *  3. Post.content keyword heuristic → content type distribution
 *
 * @task SYN-521
 */

import prisma from '@/lib/prisma';
import type { CalendarPlatform, ContentType, DigestSignals } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum completed digests before we allow calendar generation */
export const MIN_DIGESTS_REQUIRED = 3;

/** Number of days of published post history to analyse for signals */
const SIGNAL_WINDOW_DAYS = 90;

/** Platforms that map to our CalendarPlatform type */
const VALID_PLATFORMS = new Set<CalendarPlatform>([
  'instagram',
  'facebook',
  'linkedin',
  'twitter',
  'tiktok',
  'youtube',
  'pinterest',
  'reddit',
  'threads',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Frequency-rank a string array: most common first */
function frequencyRank<T extends string>(items: T[]): T[] {
  const counts = new Map<T, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([item]) => item);
}

/** Classify a post's content based on keyword heuristics */
function classifyContentType(content: string): ContentType {
  const lower = content.toLowerCase();
  if (/tip|how to|guide|learn|did you know|fact/i.test(lower))
    return 'educational';
  if (/sale|off|discount|promo|deal|offer|buy|shop/i.test(lower))
    return 'promotional';
  if (/behind|team|day in|sneak|peek|office/i.test(lower))
    return 'behind-the-scenes';
  if (/review|testimonial|said|loved|happy customer/i.test(lower))
    return 'testimonial';
  if (/trending|viral|everyone|hot right now/i.test(lower)) return 'trending';
  return 'engagement'; // default
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Read digest count and derive content signals for an organisation.
 * Does NOT throw InsufficientDigestsError — callers check `digestCount`.
 */
export async function readDigestSignals(
  organizationId: string
): Promise<DigestSignals> {
  const signalWindowStart = new Date();
  signalWindowStart.setDate(signalWindowStart.getDate() - SIGNAL_WINDOW_DAYS);

  // ── 1. Count digests ─────────────────────────────────────────────────────
  // AIWeeklyDigest is user-scoped; get all user IDs in this org first
  const orgUsers = await prisma.user.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const userIds = orgUsers.map(u => u.id);

  const digestCount =
    userIds.length > 0
      ? await prisma.aIWeeklyDigest.count({
          where: { userId: { in: userIds } },
        })
      : 0;

  // ── 2. Query recent published posts ──────────────────────────────────────
  const recentPosts = await prisma.post.findMany({
    where: {
      campaign: { organizationId },
      status: 'published',
      publishedAt: { gte: signalWindowStart },
    },
    select: {
      content: true,
      platform: true,
      metadata: true, // hashtags live here as metadata.hashtags: string[]
      publishedAt: true,
    },
    orderBy: { publishedAt: 'desc' },
    take: 200,
  });

  // ── 3. Extract active platforms ───────────────────────────────────────────
  const platformsRaw = recentPosts
    .map(p => p.platform as CalendarPlatform)
    .filter(p => VALID_PLATFORMS.has(p));
  const activePlatforms = frequencyRank(platformsRaw).slice(
    0,
    5
  ) as CalendarPlatform[];

  // ── 4. Peak engagement hours from publishedAt timestamps ─────────────────
  const hourStrings = recentPosts
    .filter(p => p.publishedAt !== null)
    .map(p => String(new Date(p.publishedAt!).getUTCHours()));
  const peakEngagementHours = frequencyRank(hourStrings)
    .slice(0, 6)
    .map(Number);

  // ── 5. Top content types from keyword heuristic ───────────────────────────
  const contentTypes = recentPosts.map(p => classifyContentType(p.content));
  const topContentTypes = frequencyRank(contentTypes).slice(
    0,
    3
  ) as ContentType[];

  // ── 6. Winning hashtags from published posts (stored in metadata.hashtags) ──
  const allHashtags = recentPosts.flatMap(p => {
    const meta = p.metadata as { hashtags?: string[] } | null;
    return meta?.hashtags ?? [];
  });
  const winningHashtags = frequencyRank(allHashtags).slice(0, 30);

  // Fallback: if no signal data yet (org just onboarded), use sensible defaults
  return {
    digestCount,
    topContentTypes:
      topContentTypes.length > 0
        ? topContentTypes
        : ['educational', 'engagement', 'promotional'],
    peakEngagementHours:
      peakEngagementHours.length > 0 ? peakEngagementHours : [9, 12, 17, 19], // default peak hours (AU business time)
    winningHashtags: winningHashtags.length > 0 ? winningHashtags : [],
    activePlatforms:
      activePlatforms.length > 0 ? activePlatforms : ['instagram', 'facebook'],
  };
}
