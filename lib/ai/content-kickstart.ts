/**
 * Post-Onboarding AI Content Kickstart
 *
 * Generates the first week's content drafts immediately after onboarding
 * completes, so the user lands on the dashboard with ready-to-publish posts.
 *
 * For each connected platform:
 *   1. Creates a "Getting Started — {Platform}" Campaign
 *   2. Generates one AI draft Post linked to that campaign
 *
 * Input: onboarding pipeline result (brand, persona, topics, platforms)
 * Output: Platform-specific content drafts saved as Campaign + Post records
 *
 * @module lib/ai/content-kickstart
 */

import { getAIProvider } from '@/lib/ai/providers';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface KickstartInput {
  userId: string;
  organizationId: string;
  businessName: string;
  industry?: string;
  description?: string;
  keyTopics?: string[];
  targetAudience?: string;
  suggestedTone?: string;
  suggestedPersonaName?: string;
  connectedPlatforms: string[];
  postingMode: 'manual' | 'assisted' | 'auto';
}

export interface KickstartResult {
  draftsCreated: number;
  campaignIds: string[];
  postIds: string[];
  platforms: string[];
}

// ============================================================================
// PLATFORM CONTENT SPECS
// ============================================================================

interface PlatformSpec {
  maxChars: number;
  style: string;
  hashtagCount: number;
}

const PLATFORM_SPECS: Record<string, PlatformSpec> = {
  instagram:  { maxChars: 2200, style: 'visual, emoji-rich, storytelling',               hashtagCount: 10 },
  twitter:    { maxChars: 280,  style: 'concise, punchy, conversational',                hashtagCount: 2  },
  linkedin:   { maxChars: 1300, style: 'professional, insightful, industry-focused',     hashtagCount: 3  },
  facebook:   { maxChars: 500,  style: 'engaging, community-focused, conversational',    hashtagCount: 3  },
  tiktok:     { maxChars: 300,  style: 'trendy, energetic, hook-driven',                 hashtagCount: 5  },
  youtube:    { maxChars: 400,  style: 'descriptive, keyword-rich, CTA-driven',          hashtagCount: 5  },
  pinterest:  { maxChars: 500,  style: 'inspirational, keyword-rich, descriptive',       hashtagCount: 5  },
  threads:    { maxChars: 500,  style: 'casual, conversational, text-based',             hashtagCount: 2  },
  reddit:     { maxChars: 1000, style: 'informative, community-driven, no hard sell',    hashtagCount: 0  },
};

/** Max number of platforms to generate drafts for */
const MAX_PLATFORMS = 7;

/** Content themes for the first week */
const FIRST_WEEK_THEMES = [
  'introduction — who we are and what we do',
  'value proposition — the core problem we solve',
  'behind the scenes — how we work',
  'educational tip from our expertise',
  'customer pain point + how we address it',
  'social proof or success story concept',
  'call to action — invite engagement or enquiry',
] as const;

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generate first-week content drafts and save them to Campaign + Post tables.
 * Creates one Campaign per platform, with one AI-generated draft Post.
 */
export async function generateKickstartContent(
  input: KickstartInput,
): Promise<KickstartResult> {
  const result: KickstartResult = {
    draftsCreated: 0,
    campaignIds: [],
    postIds: [],
    platforms: [],
  };

  const platforms = input.connectedPlatforms
    .filter((p) => p in PLATFORM_SPECS)
    .slice(0, MAX_PLATFORMS);

  if (platforms.length === 0) {
    logger.info('[kickstart] No recognised platforms — skipping', { userId: input.userId });
    return result;
  }

  const ai = getAIProvider();

  const tone = input.suggestedTone ?? 'professional';
  const topics =
    input.keyTopics?.slice(0, 5).join(', ') ??
    input.industry ??
    'general business';
  const audience = input.targetAudience ?? 'potential customers';
  const now = new Date();

  logger.info('[kickstart] Generating first-week content', {
    userId: input.userId,
    platforms,
    topics,
  });

  // Generate one draft per platform (parallel)
  await Promise.all(
    platforms.map(async (platform, idx) => {
      const spec = PLATFORM_SPECS[platform]!;
      const theme = FIRST_WEEK_THEMES[idx % FIRST_WEEK_THEMES.length];

      // ── 1. Generate AI content ─────────────────────────────────────
      let content = '';
      let hashtags: string[] = [];

      try {
        const systemPrompt = `You are a social media expert writing for ${input.businessName}.
Business: ${input.description ?? `${input.businessName} — ${input.industry ?? 'professional services'}`}
Target audience: ${audience}
Tone: ${tone}
Key topics: ${topics}

Write a ${platform} post on the theme: "${theme}"
Rules:
- Caption max ${spec.maxChars} characters
- Style: ${spec.style}
- ${spec.hashtagCount > 0 ? `List exactly ${spec.hashtagCount} relevant hashtags separately after HASHTAGS:` : 'No hashtags needed'}
- Sound human, not AI-generated
- Start directly with the post content, no title line

Response format:
CONTENT: [post content]
HASHTAGS: [tag1, tag2, ...] or NONE`;

        const response = await ai.complete({
          model: ai.models.fast,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Write the ${platform} post now.` },
          ],
          temperature: 0.8,
          max_tokens: 600,
        });

        const raw = response.choices[0]?.message?.content ?? '';
        const contentMatch = raw.match(/CONTENT:\s*([\s\S]*?)(?=HASHTAGS:|$)/i);
        const hashtagMatch = raw.match(/HASHTAGS:\s*([\s\S]*)$/i);

        content = contentMatch?.[1]?.trim() ?? raw.trim();
        const hashtagRaw = hashtagMatch?.[1]?.trim() ?? '';
        hashtags =
          hashtagRaw === 'NONE' || !hashtagRaw
            ? []
            : hashtagRaw
                .split(/[,\s]+/)
                .map((h) => h.replace(/^#/, '').trim())
                .filter(Boolean)
                .slice(0, spec.hashtagCount);
      } catch (err) {
        logger.warn('[kickstart] AI generation failed for platform', {
          platform,
          error: String(err),
        });
        // Use a placeholder so the campaign/post still gets created
        content = `Welcome to ${input.businessName}! We're excited to connect with you on ${platform}. Stay tuned for more updates.`;
      }

      // ── 2. Create Campaign ──────────────────────────────────────────
      let campaignId: string;
      try {
        const campaign = await prisma.campaign.create({
          data: {
            name: `Getting Started — ${platform.charAt(0).toUpperCase() + platform.slice(1)}`,
            description: `AI-generated first-week content for ${input.businessName}`,
            platform,
            status: 'active',
            userId: input.userId,
            organizationId: input.organizationId,
            settings: { source: 'kickstart', generatedAt: now.toISOString() },
          },
          select: { id: true },
        });
        campaignId = campaign.id;
        result.campaignIds.push(campaignId);
      } catch (err) {
        logger.warn('[kickstart] Failed to create campaign', {
          platform,
          error: String(err),
        });
        return;
      }

      // ── 3. Create Post ──────────────────────────────────────────────
      try {
        // Schedule: spread posts across days 1-7 after onboarding at 9am
        const scheduledAt = new Date(now);
        scheduledAt.setDate(scheduledAt.getDate() + idx + 1);
        scheduledAt.setHours(9, 0, 0, 0);

        const post = await prisma.post.create({
          data: {
            content,
            platform,
            campaignId,
            status: input.postingMode !== 'manual' ? 'scheduled' : 'draft',
            scheduledAt: input.postingMode !== 'manual' ? scheduledAt : null,
            metadata: {
              hashtags,
              mediaUrls: [],
              source: 'kickstart',
              theme,
              generatedAt: now.toISOString(),
            },
          },
          select: { id: true },
        });

        result.postIds.push(post.id);
        result.platforms.push(platform);
        result.draftsCreated++;
      } catch (err) {
        logger.warn('[kickstart] Failed to create post', {
          platform,
          error: String(err),
        });
      }
    }),
  );

  logger.info('[kickstart] Content generation complete', {
    userId: input.userId,
    draftsCreated: result.draftsCreated,
    platforms: result.platforms,
  });

  return result;
}
