/**
 * AI Content Optimization API
 *
 * @description Optimizes content for engagement, readability, and platform-specific best practices
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - OPENROUTER_API_KEY: OpenRouter API key for AI operations (SECRET)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns error responses on failure, provides rule-based optimization
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import crypto from 'crypto';
import { openRouterClient } from '@/lib/ai/openrouter-client';
import { logger } from '@/lib/logger';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';

// Validation schema
const OptimizeRequestSchema = z.object({
  content: z.string().min(1).max(10000).describe('The content to optimize'),
  platform: z.enum(['twitter', 'linkedin', 'instagram', 'tiktok', 'facebook', 'youtube']).default('twitter'),
  goal: z.enum(['engagement', 'reach', 'conversions', 'brand_awareness', 'traffic']).default('engagement'),
  tone: z.enum(['professional', 'casual', 'humorous', 'inspirational', 'educational', 'urgent']).optional(),
  targetAudience: z.string().max(200).optional(),
  includeEmojis: z.boolean().default(true),
  includeHashtags: z.boolean().default(true),
  includeCTA: z.boolean().default(true),
  maxLength: z.number().int().min(50).max(10000).optional(),
});

// Platform character limits
const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280,
  linkedin: 3000,
  instagram: 2200,
  tiktok: 2200,
  facebook: 63206,
  youtube: 5000,
};

// CTA templates by goal
const CTA_TEMPLATES: Record<string, string[]> = {
  engagement: [
    'What do you think? 👇',
    'Share your thoughts below!',
    'Drop a comment if you agree!',
    'Tag someone who needs to see this!',
    'Double tap if this resonates!',
  ],
  reach: [
    'Share this with your network!',
    'Repost to spread the word!',
    'Help others see this!',
    'Save for later and share!',
  ],
  conversions: [
    'Click the link in bio to learn more!',
    'DM me for details!',
    'Limited spots available - act now!',
    'Get started today →',
  ],
  brand_awareness: [
    'Follow for more content like this!',
    'Stay tuned for more!',
    'Hit that follow button!',
    'Join our community!',
  ],
  traffic: [
    'Full article in the comments!',
    'Link in bio 🔗',
    'Read more at the link below!',
    'Click through for the full story!',
  ],
};

// Engagement-boosting hooks
const HOOK_STARTERS: string[] = [
  'Here\'s what nobody tells you about',
  'The truth about',
  'Stop doing this if you want',
  'I made this mistake so you don\'t have to:',
  'Unpopular opinion:',
  'Hot take:',
  'This changed everything for me:',
  'The secret to',
  'Most people don\'t realize',
  '3 things I wish I knew about',
];

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
    const userId = await getUserIdFromRequestOrCookies(request);
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

    const parseResult = OptimizeRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const {
      content,
      platform,
      goal,
      tone,
      targetAudience,
      includeEmojis,
      includeHashtags,
      includeCTA,
      maxLength
    } = parseResult.data;

    const platformLimit = maxLength || PLATFORM_LIMITS[platform] || 2000;

    let optimizedContent: string;
    let suggestions: string[] = [];
    let source: 'ai' | 'rules' = 'rules';
    let aiMetadata: { model?: string; tokensUsed?: number; responseTime?: number; usage?: Record<string, unknown>; changes?: string[] } | null = null;

    // Try AI optimization first
    try {
      if (process.env.OPENROUTER_API_KEY) {
        const prompt = buildOptimizationPrompt(
          content,
          platform,
          goal,
          tone,
          targetAudience,
          includeEmojis,
          includeHashtags,
          includeCTA,
          platformLimit
        );

        const response = await openRouterClient.complete({
          model: openRouterClient.models.creative,
          messages: [
            {
              role: 'system',
              content: `You are an expert social media content optimizer. Your task is to improve content for maximum ${goal} on ${platform}.

Return a JSON object with:
{
  "optimized": "the optimized content",
  "suggestions": ["improvement 1", "improvement 2", ...],
  "changes": ["change 1", "change 2", ...]
}

Keep the core message but enhance engagement. Follow platform best practices.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.8,
          max_tokens: 1000
        });

        const aiContent = response.choices[0]?.message?.content || '';
        const parsed = parseAIResponse(aiContent);

        if (parsed) {
          optimizedContent = parsed.optimized;
          suggestions = parsed.suggestions || [];
          source = 'ai';
          aiMetadata = {
            model: openRouterClient.models.creative,
            usage: response.usage,
            changes: parsed.changes || []
          };
        } else {
          // Fallback if AI response couldn't be parsed
          const rulesBased = applyRulesOptimization(
            content, platform, goal, includeEmojis, includeHashtags, includeCTA, platformLimit
          );
          optimizedContent = rulesBased.content;
          suggestions = rulesBased.suggestions;
        }
      } else {
        // No API key, use rules-based optimization
        const rulesBased = applyRulesOptimization(
          content, platform, goal, includeEmojis, includeHashtags, includeCTA, platformLimit
        );
        optimizedContent = rulesBased.content;
        suggestions = rulesBased.suggestions;
      }
    } catch (error) {
      logger.error('AI optimization failed, using rules-based', { error });
      const rulesBased = applyRulesOptimization(
        content, platform, goal, includeEmojis, includeHashtags, includeCTA, platformLimit
      );
      optimizedContent = rulesBased.content;
      suggestions = rulesBased.suggestions;
    }

    // Calculate optimization score
    const score = calculateOptimizationScore(optimizedContent, platform, goal);

    // Audit log
    await auditLogger.log({
      userId,
      action: 'ai.content_optimized',
      resource: 'ai_content',
      resourceId: crypto.randomUUID(),
      category: 'api',
      severity: 'low',
      outcome: 'success',
      details: {
        platform,
        goal,
        source,
        originalLength: content.length,
        optimizedLength: optimizedContent.length,
        scoreImprovement: score.overall
      }
    });

    return NextResponse.json({
      success: true,
      original: content,
      optimized: optimizedContent,
      suggestions,
      score,
      metadata: {
        platform,
        goal,
        characterCount: optimizedContent.length,
        characterLimit: platformLimit,
        source,
        aiMetadata
      }
    });
  } catch (error) {
    logger.error('Content optimization failed', { error });
    return NextResponse.json(
      { error: 'Failed to optimize content' },
      { status: 500 }
    );
  }
}

// Build optimization prompt
function buildOptimizationPrompt(
  content: string,
  platform: string,
  goal: string,
  tone?: string,
  targetAudience?: string,
  includeEmojis: boolean = true,
  includeHashtags: boolean = true,
  includeCTA: boolean = true,
  maxLength: number = 2000
): string {
  let prompt = `Optimize this ${platform} content for maximum ${goal}:\n\n"${content}"\n\n`;

  prompt += `Requirements:\n`;
  prompt += `- Maximum ${maxLength} characters\n`;
  prompt += `- Platform: ${platform}\n`;
  prompt += `- Goal: ${goal}\n`;

  if (tone) {
    prompt += `- Tone: ${tone}\n`;
  }

  if (targetAudience) {
    prompt += `- Target audience: ${targetAudience}\n`;
  }

  if (includeEmojis) {
    prompt += `- Include relevant emojis for visual appeal\n`;
  }

  if (includeHashtags) {
    prompt += `- Include 2-3 relevant hashtags\n`;
  }

  if (includeCTA) {
    prompt += `- Include a call-to-action that drives ${goal}\n`;
  }

  prompt += `\nProvide the optimized content and list specific improvements made.`;

  return prompt;
}

// Parse AI response
function parseAIResponse(content: string): { optimized: string; suggestions: string[]; changes: string[] } | null {
  try {
    // Try to parse as JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.optimized) {
        return {
          optimized: parsed.optimized,
          suggestions: parsed.suggestions || [],
          changes: parsed.changes || []
        };
      }
    }

    // Fallback: use the entire response as optimized content
    if (content.length > 20 && !content.includes('{')) {
      return {
        optimized: content.trim(),
        suggestions: ['AI-generated optimization applied'],
        changes: []
      };
    }

    return null;
  } catch {
    return null;
  }
}

// Apply rules-based optimization
function applyRulesOptimization(
  content: string,
  platform: string,
  goal: string,
  includeEmojis: boolean,
  includeHashtags: boolean,
  includeCTA: boolean,
  maxLength: number
): { content: string; suggestions: string[] } {
  let optimized = content.trim();
  const suggestions: string[] = [];

  // Add hook if content doesn't start with one
  if (!startsWithHook(optimized)) {
    const hook = HOOK_STARTERS[Math.floor(Math.random() * HOOK_STARTERS.length)];
    if (optimized.length + hook.length + 5 < maxLength) {
      // Don't prepend hook, just suggest it
      suggestions.push(`Consider starting with a hook like: "${hook}"`);
    }
  }

  // Add emojis if requested and missing
  if (includeEmojis && !hasEmojis(optimized)) {
    const emoji = getRelevantEmoji(content, goal);
    if (optimized.length + 3 < maxLength) {
      optimized = emoji + ' ' + optimized;
      suggestions.push('Added relevant emoji for visual appeal');
    }
  }

  // Add CTA if requested
  if (includeCTA && !hasCTA(optimized)) {
    const ctas = CTA_TEMPLATES[goal] || CTA_TEMPLATES.engagement;
    const cta = ctas[Math.floor(Math.random() * ctas.length)];
    if (optimized.length + cta.length + 5 < maxLength) {
      optimized = optimized + '\n\n' + cta;
      suggestions.push('Added call-to-action for better engagement');
    }
  }

  // Add hashtags if requested
  if (includeHashtags && !hasHashtags(optimized)) {
    const hashtags = generateBasicHashtags(content, platform);
    if (optimized.length + hashtags.length + 5 < maxLength) {
      optimized = optimized + '\n\n' + hashtags;
      suggestions.push('Added relevant hashtags for discoverability');
    }
  }

  // Platform-specific optimizations
  switch (platform) {
    case 'twitter':
      if (optimized.length > 250 && !optimized.includes('🧵')) {
        suggestions.push('Consider breaking into a thread for longer content');
      }
      break;
    case 'linkedin':
      if (!optimized.includes('\n\n')) {
        optimized = optimized.replace(/\. /g, '.\n\n');
        suggestions.push('Added line breaks for better LinkedIn readability');
      }
      break;
    case 'instagram':
      if (!optimized.includes('.') || optimized.includes('.\n.')) {
        // Already formatted
      } else {
        optimized = optimized.replace(/\n/g, '\n.\n');
        suggestions.push('Formatted with line breaks for Instagram algorithm');
      }
      break;
  }

  // Truncate if too long
  if (optimized.length > maxLength) {
    optimized = truncateSmart(optimized, maxLength);
    suggestions.push(`Truncated to ${maxLength} characters for platform limits`);
  }

  // Add general suggestions
  if (!optimized.includes('?')) {
    suggestions.push('Consider adding a question to boost engagement');
  }

  if (optimized.split(' ').length < 10) {
    suggestions.push('Short content may have lower reach - consider expanding');
  }

  return { content: optimized, suggestions };
}

// Calculate optimization score
interface OptimizationScore {
  overall: number;
  engagement: number;
  readability: number;
  platformFit: number;
  cta: number;
  breakdown: Record<string, number>;
}

function calculateOptimizationScore(content: string, platform: string, goal: string): OptimizationScore {
  let engagement = 50;
  let readability = 50;
  let platformFit = 50;
  let cta = 50;

  // Engagement factors
  if (content.includes('?')) engagement += 15;
  if (hasEmojis(content)) engagement += 10;
  if (hasHashtags(content)) engagement += 10;
  if (startsWithHook(content)) engagement += 15;

  // Readability factors
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = content.length / Math.max(sentences.length, 1);
  if (avgSentenceLength < 100) readability += 20;
  if (avgSentenceLength < 50) readability += 10;
  if (content.includes('\n\n')) readability += 10;

  // Platform fit
  const limit = PLATFORM_LIMITS[platform] || 2000;
  const lengthRatio = content.length / limit;
  if (lengthRatio >= 0.3 && lengthRatio <= 0.8) platformFit += 20;
  if (lengthRatio > 0.95) platformFit -= 20;

  // CTA score
  if (hasCTA(content)) cta += 30;
  if (content.toLowerCase().includes('comment') || content.toLowerCase().includes('share')) cta += 10;
  if (content.includes('👇') || content.includes('⬇️')) cta += 10;

  // Calculate overall
  const overall = Math.round((engagement + readability + platformFit + cta) / 4);

  return {
    overall: Math.min(overall, 100),
    engagement: Math.min(engagement, 100),
    readability: Math.min(readability, 100),
    platformFit: Math.min(platformFit, 100),
    cta: Math.min(cta, 100),
    breakdown: {
      hasQuestion: content.includes('?') ? 1 : 0,
      hasEmojis: hasEmojis(content) ? 1 : 0,
      hasHashtags: hasHashtags(content) ? 1 : 0,
      hasCTA: hasCTA(content) ? 1 : 0,
      hasHook: startsWithHook(content) ? 1 : 0,
      optimalLength: lengthRatio >= 0.3 && lengthRatio <= 0.8 ? 1 : 0
    }
  };
}

// Helper functions
function hasEmojis(content: string): boolean {
  return /[\u{1F300}-\u{1F9FF}]/u.test(content);
}

function hasHashtags(content: string): boolean {
  return /#\w+/.test(content);
}

function hasCTA(content: string): boolean {
  const ctaPatterns = [
    /comment|share|follow|like|save|click|tap|swipe|link|dm|message/i,
    /👇|⬇️|🔗|📲|💬|🙋/,
    /what do you think|let me know|tell me|your thoughts/i
  ];
  return ctaPatterns.some(pattern => pattern.test(content));
}

function startsWithHook(content: string): boolean {
  const hookPatterns = [
    /^(here's|the truth|stop|i made|unpopular|hot take|this changed|the secret|most people|3 things)/i,
    /^[\u{1F300}-\u{1F9FF}]/u, // Starts with emoji
    /^\d+ (things|tips|ways|reasons|mistakes)/i
  ];
  return hookPatterns.some(pattern => pattern.test(content.trim()));
}

function getRelevantEmoji(content: string, goal: string): string {
  const contentLower = content.toLowerCase();

  // Goal-based emojis
  const goalEmojis: Record<string, string[]> = {
    engagement: ['💬', '🗣️', '👇', '🤔', '💭'],
    reach: ['📢', '🚀', '🔥', '⚡', '🌟'],
    conversions: ['🎯', '💰', '📈', '✅', '🏆'],
    brand_awareness: ['✨', '🌟', '💡', '🎨', '👋'],
    traffic: ['🔗', '👆', '📲', '🖱️', '➡️']
  };

  // Content-based emoji selection
  if (contentLower.includes('success') || contentLower.includes('win')) return '🏆';
  if (contentLower.includes('money') || contentLower.includes('revenue')) return '💰';
  if (contentLower.includes('grow') || contentLower.includes('scale')) return '📈';
  if (contentLower.includes('tip') || contentLower.includes('advice')) return '💡';
  if (contentLower.includes('mistake') || contentLower.includes('error')) return '⚠️';
  if (contentLower.includes('love') || contentLower.includes('passion')) return '❤️';

  const emojis = goalEmojis[goal] || goalEmojis.engagement;
  return emojis[Math.floor(Math.random() * emojis.length)];
}

function generateBasicHashtags(content: string, platform: string): string {
  const platformHashtags: Record<string, string[]> = {
    twitter: ['#growth', '#success', '#entrepreneur'],
    linkedin: ['#leadership', '#business', '#career'],
    instagram: ['#instagood', '#motivation', '#lifestyle'],
    tiktok: ['#fyp', '#viral', '#trending'],
    facebook: ['#community', '#inspiration', '#life'],
    youtube: ['#subscribe', '#content', '#creator']
  };

  const tags = platformHashtags[platform] || platformHashtags.twitter;
  return tags.slice(0, 3).join(' ');
}

function truncateSmart(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;

  // Try to cut at sentence boundary
  const truncated = content.substring(0, maxLength - 3);
  const lastSentence = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');

  const cutPoint = Math.max(lastSentence, lastNewline);
  if (cutPoint > maxLength * 0.7) {
    return content.substring(0, cutPoint + 1);
  }

  return truncated + '...';
}

// Node.js runtime required for OpenRouter API calls
export const runtime = 'nodejs';
