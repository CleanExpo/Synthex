/**
 * Profile-Analyser Content Generation API
 *
 * POST /api/profile-analyser/generate-content
 *
 * Takes structured profile data (returned by /api/profile-analyser) and an
 * optional topic, then returns:
 *   - Three platform-appropriate post variations
 *   - Smart scheduling recommendations
 *   - Profile improvement tips
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { OpenRouterClient } from '@/lib/ai/openrouter-client';
import { aiGeneration } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import type { ProfileData, SupportedPlatform } from '../route';

// ---------------------------------------------------------------------------
// Research-backed default scheduling per platform
// ---------------------------------------------------------------------------

const DEFAULT_SLOTS: Record<SupportedPlatform, ScheduleSlot[]> = {
  instagram: [
    {
      day: 'Tuesday',
      time: '9:00 AM – 11:00 AM',
      rationale:
        'Highest mid-week morning engagement on Instagram for most niches.',
    },
    {
      day: 'Wednesday',
      time: '11:00 AM',
      rationale:
        'Peak mid-week slot — audiences check feeds during lunch breaks.',
    },
    {
      day: 'Thursday',
      time: '9:00 AM – 11:00 AM',
      rationale: 'Second highest weekday traffic before the weekend slowdown.',
    },
  ],
  twitter: [
    {
      day: 'Monday',
      time: '8:00 AM – 10:00 AM',
      rationale:
        'Twitter peaks early Monday as users catch up with the week ahead.',
    },
    {
      day: 'Wednesday',
      time: '9:00 AM',
      rationale: 'Mid-week sweet spot for maximum impressions and retweets.',
    },
    {
      day: 'Friday',
      time: '9:00 AM – 12:00 PM',
      rationale:
        'Friday mornings outperform evenings for professional content.',
    },
  ],
  linkedin: [
    {
      day: 'Tuesday',
      time: '9:00 AM – 12:00 PM',
      rationale:
        'LinkedIn professionals are most active Tuesday–Thursday mornings.',
    },
    {
      day: 'Wednesday',
      time: '9:00 AM – 12:00 PM',
      rationale:
        'Peak engagement day for thought-leadership and career content.',
    },
    {
      day: 'Thursday',
      time: '9:00 AM – 12:00 PM',
      rationale:
        'Decision-makers check LinkedIn Thursday to wrap the work week.',
    },
  ],
  tiktok: [
    {
      day: 'Tuesday',
      time: '7:00 PM – 9:00 PM',
      rationale: 'TikTok evening sessions spike Tuesday when users wind down.',
    },
    {
      day: 'Thursday',
      time: '7:00 PM – 9:00 PM',
      rationale:
        'Pre-weekend energy drives higher completion rates Thursday evening.',
    },
    {
      day: 'Friday',
      time: '7:00 PM – 9:00 PM',
      rationale:
        'Weekend mood starts Friday night — entertainment content peaks.',
    },
  ],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduleSlot {
  day: string;
  time: string;
  rationale: string;
}

export interface GenerateContentResult {
  posts: { variation: number; content: string; hashtags: string[] }[];
  schedulingSlots: ScheduleSlot[];
  improvementTips: string[];
}

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const profileDataSchema = z.object({
  platform: z.enum(['instagram', 'twitter', 'linkedin', 'tiktok']),
  username: z.string(),
  displayName: z.string().nullable(),
  bio: z.string().nullable(),
  followerCount: z.number(),
  followingCount: z.number(),
  postCount: z.number(),
  engagementRate: z.number().nullable(),
  topHashtags: z.array(z.string()),
  postingFrequencyPerWeek: z.number().nullable(),
  audienceActivityPatterns: z
    .array(z.object({ hour: z.number(), day: z.string(), score: z.number() }))
    .nullable(),
  avatarUrl: z.string().nullable(),
  verified: z.boolean(),
  profileUrl: z.string(),
});

const bodySchema = z.object({
  profile: profileDataSchema,
  topic: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Build scheduling slots
// ---------------------------------------------------------------------------

function buildSchedulingSlots(profile: ProfileData): ScheduleSlot[] {
  if (
    profile.audienceActivityPatterns &&
    profile.audienceActivityPatterns.length > 0
  ) {
    // Sort patterns by score descending, take top 3
    const top3 = [...profile.audienceActivityPatterns]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return top3.map(p => ({
      day: p.day,
      time: `${p.hour}:00`,
      rationale: `High audience activity score (${p.score.toFixed(0)}) detected from your profile data.`,
    }));
  }
  return DEFAULT_SLOTS[profile.platform];
}

// ---------------------------------------------------------------------------
// Build AI prompt
// ---------------------------------------------------------------------------

function buildPrompt(profile: ProfileData, topic: string | undefined): string {
  const platformName = {
    instagram: 'Instagram',
    twitter: 'Twitter/X',
    linkedin: 'LinkedIn',
    tiktok: 'TikTok',
  }[profile.platform];

  const hashtagsStr = profile.topHashtags.length
    ? profile.topHashtags.join(', ')
    : 'none observed';

  const engagementStr =
    profile.engagementRate != null
      ? `${profile.engagementRate.toFixed(2)}%`
      : 'unknown';

  const followerRatio =
    profile.followingCount > 0
      ? (profile.followerCount / profile.followingCount).toFixed(2)
      : 'N/A';

  const topicLine = topic
    ? `The user wants content about: "${topic}".`
    : 'Generate on-brand content that fits the profile naturally — no specific topic given.';

  return `You are an expert social media content strategist. Analyse this ${platformName} profile and generate tailored content.

PROFILE DATA:
- Username: @${profile.username}
- Display name: ${profile.displayName ?? 'not set'}
- Bio: ${profile.bio ?? 'no bio'}
- Followers: ${profile.followerCount.toLocaleString()}
- Following: ${profile.followingCount.toLocaleString()} (ratio: ${followerRatio})
- Posts: ${profile.postCount.toLocaleString()}
- Engagement rate: ${engagementStr}
- Top hashtags used: ${hashtagsStr}
- Posting frequency: ${profile.postingFrequencyPerWeek != null ? `${profile.postingFrequencyPerWeek} posts/week` : 'unknown'}

TASK: ${topicLine}

Respond ONLY with valid JSON matching this exact schema (no markdown, no extra text):
{
  "posts": [
    { "variation": 1, "content": "full post text matching platform style and length", "hashtags": ["hashtag1", "hashtag2"] },
    { "variation": 2, "content": "...", "hashtags": [...] },
    { "variation": 3, "content": "...", "hashtags": [...] }
  ],
  "improvementTips": [
    "Specific tip 1 based on the profile data above",
    "Specific tip 2",
    "Specific tip 3"
  ]
}

Requirements for posts:
- Match the platform's native style (${platformName})
- Instagram/TikTok: emojis, line breaks, 8–15 hashtags at end
- Twitter/X: punchy, under 280 chars per tweet, 1–3 hashtags inline or at end
- LinkedIn: professional tone, 150–300 words, 3–5 hashtags at end, add a CTA question
- Vary the hook, angle, and structure across the 3 variations
- Reflect the profile's tone and existing hashtag style

Requirements for improvementTips (3–5 tips):
- Derive each tip directly from the profile data above
- Be specific and actionable, not generic
- Include concrete numbers or benchmarks where relevant
- Address bio quality, follower/following ratio, posting frequency, and engagement rate
- Each tip must be a single sentence, plain English, no bullet prefix`;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // Calls OpenRouter on every request — 20 req/min per IP.
  return aiGeneration(request, () => handlePost(request));
}

async function handlePost(request: NextRequest): Promise<NextResponse> {
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

    const { profile, topic } = parsed.data;
    const schedulingSlots = buildSchedulingSlots(profile as ProfileData);
    const prompt = buildPrompt(profile as ProfileData, topic);

    const ai = new OpenRouterClient();
    const aiResponse = await ai.complete({
      model: ai.models.balanced,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 2000,
    });

    const rawText = aiResponse.choices[0]?.message?.content ?? '';

    // Strip markdown fences if present
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let aiResult: {
      posts: GenerateContentResult['posts'];
      improvementTips: string[];
    };
    try {
      aiResult = JSON.parse(jsonText);
    } catch {
      logger.error('Failed to parse AI JSON response', { rawText });
      return NextResponse.json(
        { error: 'AI returned an unexpected format. Please try again.' },
        { status: 502 }
      );
    }

    const result: GenerateContentResult = {
      posts: aiResult.posts ?? [],
      schedulingSlots,
      improvementTips: aiResult.improvementTips ?? [],
    };

    return NextResponse.json({ success: true, result });
  } catch (err) {
    logger.error('Profile analyser generate-content error', { err });
    return NextResponse.json(
      { error: 'Failed to generate content. Please try again.' },
      { status: 500 }
    );
  }
}
