/**
 * Onboarding — Save Social Profiles (UNI-1189)
 *
 * Accepts up to 9 platform profile URLs plus the user's preferred posting mode.
 * Each URL is lightly validated (format check + HEAD request where possible).
 * Results are saved to OnboardingProgress.socialProfileUrls + postingMode.
 *
 * Non-fatal DB save: if the org doesn't exist yet (new user path), the data is
 * returned and the client caches it to sessionStorage.
 *
 * POST /api/onboarding/social-profiles
 * Body: SocialProfilesPayload
 * Returns: SocialProfilesSaveResult
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getAuthUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ============================================================================
// VALIDATION
// ============================================================================

const POSTING_MODES = ['manual', 'assisted', 'auto'] as const;
export type PostingMode = typeof POSTING_MODES[number];

const platformUrlSchema = z
  .string()
  .url('Enter a valid URL')
  .or(z.literal(''))
  .optional();

const socialProfilesSchema = z.object({
  postingMode: z.enum(POSTING_MODES),
  profiles: z.object({
    instagram:  platformUrlSchema,
    facebook:   platformUrlSchema,
    linkedin:   platformUrlSchema,
    x:          platformUrlSchema,
    tiktok:     platformUrlSchema,
    youtube:    platformUrlSchema,
    pinterest:  platformUrlSchema,
    reddit:     platformUrlSchema,
    threads:    platformUrlSchema,
  }),
});

// ============================================================================
// TYPES (exported for page component)
// ============================================================================

export type SocialProfilesPayload = z.infer<typeof socialProfilesSchema>;

export interface VerifiedProfile {
  platform: string;
  url: string;
  reachable: boolean;
}

export interface SocialProfilesSaveResult {
  saved: boolean;
  verifiedProfiles: VerifiedProfile[];
  postingMode: PostingMode;
}

// ============================================================================
// PLATFORM CONFIG — expected URL prefixes for normalisation checks
// ============================================================================

const PLATFORM_PREFIXES: Record<string, string[]> = {
  instagram: ['https://instagram.com/', 'https://www.instagram.com/'],
  facebook:  ['https://facebook.com/', 'https://www.facebook.com/'],
  linkedin:  ['https://linkedin.com/', 'https://www.linkedin.com/'],
  x:         ['https://x.com/', 'https://twitter.com/'],
  tiktok:    ['https://tiktok.com/', 'https://www.tiktok.com/'],
  youtube:   ['https://youtube.com/', 'https://www.youtube.com/'],
  pinterest: ['https://pinterest.com/', 'https://www.pinterest.com/'],
  reddit:    ['https://reddit.com/', 'https://www.reddit.com/'],
  threads:   ['https://threads.net/', 'https://www.threads.net/'],
};

/**
 * Lightweight URL reachability check via HEAD request.
 * Times out after 5 seconds so the route doesn't hang.
 * Returns true if response is 2xx or 3xx (many social pages return 301/302).
 */
async function checkReachable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'SynthexBot/1.0 (+https://synthex.social/bot)',
      },
    });

    clearTimeout(timeout);
    return res.ok || (res.status >= 300 && res.status < 400);
  } catch {
    // Fetch blocked (CORS, network, timeout) — treat as unreachable but don't fail
    return false;
  }
}

// ============================================================================
// POST — Save Social Profiles
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const rawBody = await request.json();
    const validation = socialProfilesSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 },
      );
    }

    const { postingMode, profiles } = validation.data;

    // Collect non-empty URLs for verification
    const profileEntries = Object.entries(profiles).filter(
      ([, url]) => url && url.length > 0,
    ) as [string, string][];

    // Run reachability checks in parallel (cap at 5s per check)
    const verifiedProfiles: VerifiedProfile[] = await Promise.all(
      profileEntries.map(async ([platform, url]) => ({
        platform,
        url,
        reachable: await checkReachable(url),
      })),
    );

    logger.info('Social profiles verified', {
      userId: user.id,
      platforms: profileEntries.map(([p]) => p),
      postingMode,
    });

    // Persist to OnboardingProgress if user already has an organisation
    // (Non-fatal — client falls back to sessionStorage)
    let saved = false;
    try {
      const org = await prisma.organization.findFirst({
        where: { users: { some: { id: user.id } } },
        select: { id: true },
      });

      if (org) {
        await prisma.onboardingProgress.upsert({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: org.id,
            },
          },
          create: {
            userId: user.id,
            organizationId: org.id,
            socialProfileUrls: profiles as unknown as Prisma.InputJsonValue,
            postingMode,
            completedStages: [],
            requiredProviders: [],
            selectedPlatforms: [],
          },
          update: {
            socialProfileUrls: profiles as unknown as Prisma.InputJsonValue,
            postingMode,
          },
        });
        saved = true;
        logger.info('socialProfileUrls + postingMode saved', { userId: user.id });
      }
    } catch (dbErr) {
      logger.warn('OnboardingProgress social profiles save skipped', { error: String(dbErr) });
    }

    const result: SocialProfilesSaveResult = {
      saved,
      verifiedProfiles,
      postingMode,
    };

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Social profiles save error', { error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
