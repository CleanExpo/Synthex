/**
 * Content Variations API
 *
 * @description API endpoints for AI-powered content variations:
 * - POST: Generate variations for content
 * - GET: Get available variation strategies
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - OPENROUTER_API_KEY: AI service key (SECRET)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 *
 * SECURITY: POST requires authentication, GET is public (strategy list)
 * FAILURE MODE: Returns fallback variations if AI fails
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ResponseOptimizer } from '@/lib/api/response-optimizer';
import { logger } from '@/lib/logger';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { requireApiKey } from '@/lib/middleware/require-api-key';
import {
  ContentVariationsService,
  type VariationConfig,
  type VariationStrategy,
  type PlatformStyle,
} from '@/src/services/ai/content-variations';

// ============================================================================
// POST - Generate Variations
// ============================================================================

const variationsSchema = z.object({
  content: z.string().min(1),
  platform: z.enum(['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok', 'threads']),
  count: z.number().min(1).max(10).optional().default(3),
  strategies: z.array(z.enum(['tone', 'length', 'hook', 'cta', 'emoji', 'hashtag', 'question', 'statistic', 'story'])).optional(),
  personaId: z.string().optional(),
  context: z.string().optional(),
  audience: z.string().optional(),
  goal: z.enum(['engagement', 'conversion', 'awareness', 'education']).optional().default('engagement'),
});

export async function POST(request: NextRequest) {
  return requireApiKey(request, async () => {
  try {
    // Authentication required for content generation
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );
    if (!security.allowed) {
      return ResponseOptimizer.createErrorResponse(
        security.error || 'Authentication required',
        security.error?.includes('Rate limit') ? 429 : 401
      );
    }

    const body = await request.json();
    const validation = variationsSchema.safeParse(body);
    if (!validation.success) {
      return ResponseOptimizer.createErrorResponse(
        `Invalid request data: ${validation.error.issues.map(i => i.message).join(', ')}`,
        400
      );
    }
    const {
      content,
      platform,
      count,
      strategies,
      personaId,
      context,
      audience,
      goal,
    } = validation.data;

    // Platform and strategy validation handled by Zod schema above

    const service = new ContentVariationsService();

    const config: VariationConfig = {
      originalContent: content,
      platform,
      count,
      strategies: strategies || ['tone', 'hook', 'cta'],
      personaId,
      context,
      audience,
      goal,
    };

    const variations = await service.generateVariations(config);

    logger.info('Content variations generated', {
      platform,
      count: variations.length,
      strategies: config.strategies,
    });

    return ResponseOptimizer.createResponse(
      {
        success: true,
        original: content,
        platform,
        variations: variations.map(v => ({
          id: v.id,
          content: v.content,
          strategy: v.strategy,
          tone: v.tone,
          score: v.score,
          metadata: {
            characterCount: v.metadata.characterCount,
            wordCount: v.metadata.wordCount,
            emojiCount: v.metadata.emojiCount,
            hashtagCount: v.metadata.hashtagCount,
            hasQuestion: v.metadata.hasQuestion,
            hasCTA: v.metadata.hasCTA,
            estimatedEngagement: v.metadata.estimatedEngagement,
          },
        })),
        bestVariation: variations[0]?.id,
      },
      { cacheType: 'none' }
    );
  } catch (error) {
    logger.error('Failed to generate variations', { error });
    return ResponseOptimizer.createErrorResponse('Failed to generate variations', 500);
  }
  });
}

// ============================================================================
// GET - Get Available Strategies
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    return ResponseOptimizer.createResponse(
      {
        strategies: [
          { id: 'tone', name: 'Tone Variation', description: 'Change the tone while keeping the message' },
          { id: 'length', name: 'Length Variation', description: 'Create shorter or longer versions' },
          { id: 'hook', name: 'Hook Variation', description: 'Start with a stronger, attention-grabbing hook' },
          { id: 'cta', name: 'CTA Variation', description: 'Add or improve the call-to-action' },
          { id: 'emoji', name: 'Emoji Variation', description: 'Add strategic emojis for engagement' },
          { id: 'hashtag', name: 'Hashtag Variation', description: 'Optimize hashtags for discoverability' },
          { id: 'question', name: 'Question Variation', description: 'Start with an engaging question' },
          { id: 'statistic', name: 'Statistic Variation', description: 'Lead with a compelling statistic or fact' },
          { id: 'story', name: 'Story Variation', description: 'Frame it as a mini story or narrative' },
        ],
        tones: [
          { id: 'professional', name: 'Professional', description: 'Formal, polished, and business-appropriate' },
          { id: 'casual', name: 'Casual', description: 'Relaxed, friendly, and approachable' },
          { id: 'humorous', name: 'Humorous', description: 'Witty, playful, with light humor' },
          { id: 'inspirational', name: 'Inspirational', description: 'Motivating, uplifting, and empowering' },
          { id: 'urgent', name: 'Urgent', description: 'Time-sensitive, action-oriented, and compelling' },
          { id: 'educational', name: 'Educational', description: 'Informative, clear, and instructive' },
          { id: 'conversational', name: 'Conversational', description: 'Natural, engaging, like talking to a friend' },
          { id: 'authoritative', name: 'Authoritative', description: 'Expert, confident, and trustworthy' },
        ],
        platforms: [
          { id: 'twitter', name: 'Twitter/X', maxLength: 280, hashtagLimit: 3 },
          { id: 'instagram', name: 'Instagram', maxLength: 2200, hashtagLimit: 30 },
          { id: 'linkedin', name: 'LinkedIn', maxLength: 3000, hashtagLimit: 5 },
          { id: 'facebook', name: 'Facebook', maxLength: 500, hashtagLimit: 3 },
          { id: 'tiktok', name: 'TikTok', maxLength: 300, hashtagLimit: 5 },
          { id: 'threads', name: 'Threads', maxLength: 500, hashtagLimit: 5 },
        ],
        goals: ['engagement', 'conversion', 'awareness', 'education'],
      },
      { cacheType: 'api', cacheDuration: 3600 }
    );
  } catch (error) {
    logger.error('Failed to get variation options', { error });
    return ResponseOptimizer.createErrorResponse('Failed to get variation options', 500);
  }
}
