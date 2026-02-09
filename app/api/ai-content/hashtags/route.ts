/**
 * AI Hashtag Generation API
 *
 * @description Generates relevant hashtags using AI based on content and platform
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - OPENROUTER_API_KEY: OpenRouter API key for AI operations (SECRET)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns error responses on failure, falls back to rule-based hashtags
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { openRouterClient } from '@/lib/ai/openrouter-client';
import { logger } from '@/lib/logger';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';

// Lazy getter to avoid module load crash
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET required');
  return secret;
}

// Helper to extract user ID from request
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const token =
    request.cookies.get('auth-token')?.value ||
    request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getJWTSecret()) as {
      sub?: string;
      userId?: string;
      id?: string;
    };
    return decoded.sub || decoded.userId || decoded.id || null;
  } catch {
    return null;
  }
}

// Validation schema
const HashtagRequestSchema = z.object({
  content: z.string().min(1).max(5000).describe('The content to generate hashtags for'),
  platform: z.enum(['twitter', 'linkedin', 'instagram', 'tiktok', 'facebook', 'youtube']).default('twitter'),
  count: z.number().int().min(1).max(30).default(5),
  topic: z.string().max(100).optional(),
  niche: z.string().max(100).optional(),
  includeNiche: z.boolean().default(true),
  includeTrending: z.boolean().default(true),
  style: z.enum(['broad', 'targeted', 'mixed']).default('mixed'),
});

// Platform-specific hashtag limits
const PLATFORM_HASHTAG_LIMITS: Record<string, number> = {
  twitter: 3,
  linkedin: 5,
  instagram: 30,
  tiktok: 10,
  facebook: 10,
  youtube: 15,
};

// Fallback hashtag categories for rule-based generation
const HASHTAG_CATEGORIES: Record<string, string[]> = {
  business: ['#business', '#entrepreneur', '#startup', '#success', '#growth', '#leadership', '#motivation', '#innovation'],
  marketing: ['#marketing', '#digitalmarketing', '#socialmedia', '#branding', '#contentmarketing', '#seo', '#advertising'],
  tech: ['#tech', '#technology', '#ai', '#machinelearning', '#coding', '#software', '#programming', '#developer'],
  lifestyle: ['#lifestyle', '#life', '#motivation', '#inspiration', '#goals', '#mindset', '#wellness', '#selfcare'],
  fitness: ['#fitness', '#workout', '#gym', '#health', '#training', '#fitlife', '#exercise', '#gains'],
  food: ['#food', '#foodie', '#cooking', '#recipe', '#healthyfood', '#yummy', '#instafood', '#homemade'],
  travel: ['#travel', '#wanderlust', '#adventure', '#explore', '#vacation', '#travelgram', '#photography'],
  fashion: ['#fashion', '#style', '#ootd', '#outfit', '#fashionista', '#trendy', '#clothing', '#streetstyle'],
};

// Platform-specific trending hashtags
const PLATFORM_TRENDING: Record<string, string[]> = {
  twitter: ['#trending', '#viral', '#thread'],
  linkedin: ['#hiring', '#opentowork', '#careergrowth', '#thoughtleadership'],
  instagram: ['#instagood', '#photooftheday', '#explore', '#reels', '#viral'],
  tiktok: ['#fyp', '#foryou', '#foryoupage', '#viral', '#trending'],
  facebook: ['#community', '#share', '#viral'],
  youtube: ['#shorts', '#subscribe', '#viral', '#trending'],
};

export async function POST(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    // Get requesting user ID
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const parseResult = HashtagRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { content, platform, count, topic, niche, includeNiche, includeTrending, style } = parseResult.data;

    // Get platform limit
    const platformLimit = PLATFORM_HASHTAG_LIMITS[platform] || 10;
    const effectiveCount = Math.min(count, platformLimit);

    let hashtags: string[] = [];
    let source: 'ai' | 'fallback' = 'fallback';
    let aiMetadata: any = null;

    // Try AI generation first
    try {
      if (process.env.OPENROUTER_API_KEY) {
        const prompt = buildHashtagPrompt(content, platform, effectiveCount, topic, niche, style);

        const response = await openRouterClient.complete({
          model: openRouterClient.models.balanced,
          messages: [
            {
              role: 'system',
              content: `You are a social media expert specializing in hashtag optimization for ${platform}.
Generate highly relevant, engaging hashtags that maximize reach and engagement.
Return ONLY a JSON array of hashtags, each starting with #.
Example: ["#marketing", "#growth", "#success"]`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 300
        });

        const aiContent = response.choices[0]?.message?.content || '';
        const parsedHashtags = parseHashtagsFromAI(aiContent);

        if (parsedHashtags.length > 0) {
          hashtags = parsedHashtags.slice(0, effectiveCount);
          source = 'ai';
          aiMetadata = {
            model: openRouterClient.models.balanced,
            usage: response.usage
          };
        }
      }
    } catch (error) {
      logger.error('AI hashtag generation failed, using fallback', { error });
    }

    // Fallback to rule-based generation
    if (hashtags.length === 0) {
      hashtags = generateFallbackHashtags(content, platform, effectiveCount, niche, includeNiche, includeTrending);
      source = 'fallback';
    }

    // Calculate hashtag scores
    const scoredHashtags = hashtags.map(tag => ({
      tag,
      relevance: calculateRelevance(tag, content),
      popularity: estimatePopularity(tag),
      recommended: true
    }));

    // Sort by relevance
    scoredHashtags.sort((a, b) => b.relevance - a.relevance);

    // Audit log
    await auditLogger.log({
      userId,
      action: 'ai.hashtags_generated',
      resource: 'ai_content',
      resourceId: crypto.randomUUID(),
      category: 'api',
      severity: 'low',
      outcome: 'success',
      details: {
        platform,
        hashtagCount: hashtags.length,
        source,
        contentLength: content.length
      }
    });

    return NextResponse.json({
      success: true,
      hashtags: scoredHashtags.map(h => h.tag),
      detailed: scoredHashtags,
      metadata: {
        platform,
        count: hashtags.length,
        platformLimit,
        source,
        aiMetadata
      }
    });
  } catch (error) {
    logger.error('Hashtag generation failed', { error });
    return NextResponse.json(
      { error: 'Failed to generate hashtags' },
      { status: 500 }
    );
  }
}

// Build AI prompt for hashtag generation
function buildHashtagPrompt(
  content: string,
  platform: string,
  count: number,
  topic?: string,
  niche?: string,
  style?: string
): string {
  let prompt = `Generate ${count} highly relevant hashtags for ${platform} based on this content:\n\n"${content.slice(0, 1000)}"`;

  if (topic) {
    prompt += `\n\nMain topic: ${topic}`;
  }

  if (niche) {
    prompt += `\nNiche: ${niche}`;
  }

  prompt += `\n\nHashtag style: ${style}`;
  prompt += `\n- broad: General, high-volume hashtags for maximum reach`;
  prompt += `\n- targeted: Specific, niche hashtags for engaged audiences`;
  prompt += `\n- mixed: Combination of both`;

  prompt += `\n\nReturn only a JSON array of hashtags.`;

  return prompt;
}

// Parse hashtags from AI response
function parseHashtagsFromAI(content: string): string[] {
  try {
    // Try to extract JSON array
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((tag: any) => typeof tag === 'string')
          .map((tag: string) => tag.startsWith('#') ? tag : `#${tag}`)
          .map((tag: string) => tag.toLowerCase().replace(/[^#\w]/g, ''));
      }
    }

    // Fallback: extract hashtags from text
    const hashtagMatches = content.match(/#\w+/g);
    if (hashtagMatches) {
      return hashtagMatches.map(tag => tag.toLowerCase());
    }

    return [];
  } catch {
    return [];
  }
}

// Generate fallback hashtags using rules
function generateFallbackHashtags(
  content: string,
  platform: string,
  count: number,
  niche?: string,
  includeNiche: boolean = true,
  includeTrending: boolean = true
): string[] {
  const hashtags: Set<string> = new Set();
  const contentLower = content.toLowerCase();

  // Add niche hashtags
  if (includeNiche && niche) {
    const nicheKey = niche.toLowerCase();
    if (HASHTAG_CATEGORIES[nicheKey]) {
      HASHTAG_CATEGORIES[nicheKey].slice(0, 3).forEach(tag => hashtags.add(tag));
    }
  }

  // Detect categories from content
  for (const [category, tags] of Object.entries(HASHTAG_CATEGORIES)) {
    if (contentLower.includes(category)) {
      tags.slice(0, 2).forEach(tag => hashtags.add(tag));
    }
  }

  // Add platform-specific trending
  if (includeTrending && PLATFORM_TRENDING[platform]) {
    PLATFORM_TRENDING[platform].slice(0, 2).forEach(tag => hashtags.add(tag));
  }

  // Extract potential hashtags from content
  const words = content.split(/\s+/).filter(w => w.length > 3 && w.length < 20);
  const uniqueWords = [...new Set(words)];

  for (const word of uniqueWords.slice(0, 5)) {
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
    if (cleanWord.length > 3) {
      hashtags.add(`#${cleanWord}`);
    }
  }

  return [...hashtags].slice(0, count);
}

// Calculate relevance score
function calculateRelevance(hashtag: string, content: string): number {
  const tag = hashtag.replace('#', '').toLowerCase();
  const contentLower = content.toLowerCase();

  let score = 50; // Base score

  // Direct match in content
  if (contentLower.includes(tag)) {
    score += 30;
  }

  // Partial match
  const words = contentLower.split(/\s+/);
  for (const word of words) {
    if (word.includes(tag) || tag.includes(word)) {
      score += 10;
      break;
    }
  }

  // Length optimization (sweet spot 5-15 chars)
  if (tag.length >= 5 && tag.length <= 15) {
    score += 10;
  }

  return Math.min(score, 100);
}

// Estimate hashtag popularity
function estimatePopularity(hashtag: string): 'high' | 'medium' | 'low' {
  const tag = hashtag.toLowerCase();

  // Common high-volume hashtags
  const highVolume = ['fyp', 'viral', 'trending', 'instagood', 'love', 'life', 'motivation'];
  if (highVolume.some(h => tag.includes(h))) {
    return 'high';
  }

  // Medium volume indicators
  const mediumVolume = ['marketing', 'business', 'tech', 'fitness', 'food', 'travel'];
  if (mediumVolume.some(h => tag.includes(h))) {
    return 'medium';
  }

  return 'low';
}

// Import crypto for UUID generation
import crypto from 'crypto';

// Node.js runtime required for OpenRouter API calls
export const runtime = 'nodejs';
