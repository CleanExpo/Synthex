/**
 * Sentiment Analysis API Route
 *
 * @description AI-powered sentiment analysis for content:
 * - POST: Analyze text sentiment
 * - GET: Retrieve past analyses
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - OPENROUTER_API_KEY: AI service key (SECRET)
 *
 * FAILURE MODE: Returns 500 on AI/database errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { z } from 'zod';
import { aiGeneration } from '@/lib/middleware/api-rate-limit';
import { resolveAIProvider, hasAIAccess } from '@/lib/ai/api-credential-injector';
import { requireApiKey } from '@/lib/middleware/require-api-key';
import type { AIProvider } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const analyzeSentimentSchema = z.object({
  text: z.string().min(1).max(10000),
  contentType: z.enum(['post', 'comment', 'campaign', 'text']).default('text'),
  contentId: z.string().optional(),
  platform: z.string().optional(),
  predictEngagement: z.boolean().default(false),
});

// ============================================================================
// TYPES
// ============================================================================

interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  score: number; // -100 to 100
  confidence: number; // 0 to 1
  emotions: { emotion: string; intensity: number }[];
  toneIndicators: string[];
  keyPhrases: string[];
}

interface EngagementPrediction {
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  confidence: number;
}

// ============================================================================
// SENTIMENT ANALYSIS ENGINE
// ============================================================================

/**
 * Analyze sentiment using AI (uses user's own API key if available, else platform key)
 */
async function analyzeSentiment(text: string, ai?: AIProvider): Promise<SentimentResult> {
  if (!ai) {
    // No AI provider available — fall back to rule-based analysis
    return analyzeWithRules(text);
  }

  try {
    const response = await ai.complete({
      model: ai.models.balanced,
      messages: [
        {
          role: 'system',
          content: `You are a sentiment analysis expert. Analyze the given text and return a JSON object with:
- sentiment: "positive", "neutral", "negative", or "mixed"
- score: number from -100 (very negative) to 100 (very positive)
- confidence: number from 0 to 1
- emotions: array of { emotion: string, intensity: number (0-1) }
  Possible emotions: joy, sadness, anger, fear, surprise, disgust, trust, anticipation
- toneIndicators: array of tone descriptions (e.g., "professional", "casual", "urgent", "friendly")
- keyPhrases: array of key phrases that influenced the sentiment

Return ONLY valid JSON, no other text.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '';

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        sentiment: parsed.sentiment || 'neutral',
        score: Math.max(-100, Math.min(100, parsed.score || 0)),
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
        emotions: parsed.emotions || [],
        toneIndicators: parsed.toneIndicators || [],
        keyPhrases: parsed.keyPhrases || [],
      };
    }

    throw new Error('Failed to parse AI response');
  } catch (error) {
    logger.error('AI sentiment analysis failed, using fallback:', error);
    return analyzeWithRules(text);
  }
}

/**
 * Rule-based sentiment analysis fallback
 */
function analyzeWithRules(text: string): SentimentResult {
  const lowerText = text.toLowerCase();

  // Sentiment word lists
  const positiveWords = [
    'love', 'great', 'amazing', 'awesome', 'excellent', 'fantastic', 'wonderful',
    'happy', 'excited', 'thrilled', 'beautiful', 'perfect', 'best', 'good',
    'brilliant', 'outstanding', 'superb', 'incredible', 'remarkable', 'success',
    'joy', 'delighted', 'grateful', 'blessed', 'proud', 'impressive', 'innovative',
  ];

  const negativeWords = [
    'hate', 'terrible', 'awful', 'horrible', 'bad', 'worst', 'disappointing',
    'sad', 'angry', 'frustrated', 'annoying', 'poor', 'fail', 'failure',
    'ugly', 'boring', 'useless', 'waste', 'problem', 'issue', 'broken',
    'upset', 'worried', 'concerned', 'unfortunately', 'difficult', 'wrong',
  ];

  const intensifiers = ['very', 'extremely', 'incredibly', 'absolutely', 'totally', 'really'];
  const negators = ['not', "don't", "doesn't", "didn't", "won't", "can't", "never", "no"];

  // Count sentiment words
  let positiveCount = 0;
  let negativeCount = 0;

  const words = lowerText.split(/\s+/);
  let hasNegator = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^a-z]/g, '');

    if (negators.includes(word)) {
      hasNegator = true;
      continue;
    }

    const isIntensified = i > 0 && intensifiers.includes(words[i - 1].replace(/[^a-z]/g, ''));
    const weight = isIntensified ? 2 : 1;

    if (positiveWords.includes(word)) {
      if (hasNegator) {
        negativeCount += weight;
      } else {
        positiveCount += weight;
      }
      hasNegator = false;
    } else if (negativeWords.includes(word)) {
      if (hasNegator) {
        positiveCount += weight;
      } else {
        negativeCount += weight;
      }
      hasNegator = false;
    }
  }

  // Calculate score
  const total = positiveCount + negativeCount;
  let score = 0;
  let sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' = 'neutral';

  if (total > 0) {
    score = ((positiveCount - negativeCount) / total) * 100;

    if (positiveCount > 0 && negativeCount > 0 && Math.abs(positiveCount - negativeCount) <= 2) {
      sentiment = 'mixed';
    } else if (score > 20) {
      sentiment = 'positive';
    } else if (score < -20) {
      sentiment = 'negative';
    }
  }

  // Detect basic emotions
  const emotions: { emotion: string; intensity: number }[] = [];
  if (lowerText.match(/\b(happy|joy|delighted|excited)\b/)) {
    emotions.push({ emotion: 'joy', intensity: 0.7 });
  }
  if (lowerText.match(/\b(sad|disappointed|upset)\b/)) {
    emotions.push({ emotion: 'sadness', intensity: 0.7 });
  }
  if (lowerText.match(/\b(angry|frustrated|annoyed)\b/)) {
    emotions.push({ emotion: 'anger', intensity: 0.7 });
  }
  if (lowerText.match(/\b(worried|scared|afraid)\b/)) {
    emotions.push({ emotion: 'fear', intensity: 0.6 });
  }
  if (lowerText.match(/\b(surprised|shocked|amazed)\b/)) {
    emotions.push({ emotion: 'surprise', intensity: 0.7 });
  }

  return {
    sentiment,
    score: Math.round(score),
    confidence: total > 3 ? 0.7 : 0.5,
    emotions,
    toneIndicators: detectTone(text),
    keyPhrases: extractKeyPhrases(text),
  };
}

/**
 * Detect tone indicators
 */
function detectTone(text: string): string[] {
  const tones: string[] = [];
  const lowerText = text.toLowerCase();

  if (text.match(/[!]{2,}/)) tones.push('emphatic');
  if (text.match(/\?{2,}/)) tones.push('questioning');
  if (text === text.toUpperCase() && text.length > 10) tones.push('urgent');
  if (lowerText.match(/please|thank|appreciate/)) tones.push('polite');
  if (lowerText.match(/lol|haha|😂|🤣/)) tones.push('humorous');
  if (lowerText.match(/urgent|asap|immediately/)) tones.push('urgent');
  if (text.match(/[A-Z][a-z]+\s[A-Z][a-z]+/)) tones.push('professional');

  return tones.length > 0 ? tones : ['neutral'];
}

/**
 * Extract key phrases
 */
function extractKeyPhrases(text: string): string[] {
  // Simple extraction of noun phrases and important terms
  const phrases: string[] = [];
  const sentences = text.split(/[.!?]+/);

  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    if (words.length >= 2 && words.length <= 5) {
      phrases.push(sentence.trim());
    }
  }

  return phrases.slice(0, 5);
}

/**
 * Predict engagement based on sentiment and content features
 */
function predictEngagement(
  sentiment: SentimentResult,
  text: string,
  platform?: string
): EngagementPrediction {
  // Base engagement by sentiment
  const baseEngagement: Record<string, number> = {
    positive: 0.08,
    neutral: 0.04,
    negative: 0.06, // Negative can drive engagement (controversy)
    mixed: 0.05,
  };

  const base = baseEngagement[sentiment.sentiment] || 0.04;

  // Platform multipliers
  const platformMultipliers: Record<string, number> = {
    twitter: 1.2,
    instagram: 1.5,
    linkedin: 0.8,
    facebook: 1.0,
    tiktok: 2.0,
  };

  const platformMult = platform ? platformMultipliers[platform.toLowerCase()] || 1.0 : 1.0;

  // Content features
  const hasEmoji = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]/u.test(text);
  const hasHashtag = /#\w+/.test(text);
  const hasMention = /@\w+/.test(text);
  const hasQuestion = /\?/.test(text);
  const wordCount = text.split(/\s+/).length;

  let multiplier = 1.0;
  if (hasEmoji) multiplier += 0.15;
  if (hasHashtag) multiplier += 0.1;
  if (hasMention) multiplier += 0.1;
  if (hasQuestion) multiplier += 0.2;
  if (wordCount > 50 && wordCount < 150) multiplier += 0.1;

  // Emotion boost
  const joyEmotion = sentiment.emotions.find((e) => e.emotion === 'joy');
  if (joyEmotion) multiplier += joyEmotion.intensity * 0.2;

  const engagementRate = base * platformMult * multiplier;

  // Estimate absolute numbers (assuming average reach of 1000)
  const estimatedReach = 1000;
  const likes = Math.round(estimatedReach * engagementRate * 0.6);
  const comments = Math.round(estimatedReach * engagementRate * 0.2);
  const shares = Math.round(estimatedReach * engagementRate * 0.2);

  return {
    likes,
    comments,
    shares,
    engagementRate: Math.round(engagementRate * 10000) / 100,
    confidence: sentiment.confidence * 0.8,
  };
}

// ============================================================================
// POST /api/ai-content/sentiment
// Analyze text sentiment
// ============================================================================

export async function POST(request: NextRequest) {
  return requireApiKey(request, async () => {
  // Distributed rate limiting via Upstash Redis
  return aiGeneration(request, async () => {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const userId = security.context.userId!;
    const body = await request.json();

    // Validate input
    const validation = analyzeSentimentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { text, contentType, contentId, platform, predictEngagement: shouldPredict } = validation.data;

    // Resolve AI provider (user key → platform key → null)
    const aiAvailable = await hasAIAccess(userId);
    const ai = aiAvailable ? await resolveAIProvider(userId) : undefined;

    // Analyze sentiment
    const sentiment = await analyzeSentiment(text, ai);

    // Get engagement prediction if requested
    let engagementPrediction: EngagementPrediction | null = null;
    if (shouldPredict) {
      engagementPrediction = predictEngagement(sentiment, text, platform);
    }

    // Store analysis
    const analysis = await (prisma as any).sentimentAnalysis?.create({
      data: {
        userId,
        contentType,
        contentId,
        text: text.substring(0, 5000), // Limit stored text
        sentiment: sentiment.sentiment,
        score: sentiment.score,
        confidence: sentiment.confidence,
        emotions: sentiment.emotions,
        toneIndicators: sentiment.toneIndicators,
        keyPhrases: sentiment.keyPhrases,
        predictedEngagement: engagementPrediction,
        platform,
        model: ai ? ai.name : 'rule-based',
      },
    });

    // If analyzing a comment, update the comment's sentiment
    if (contentType === 'comment' && contentId) {
      await (prisma as any).contentComment?.update({
        where: { id: contentId },
        data: {
          sentiment: sentiment.sentiment,
          sentimentScore: sentiment.score,
          emotions: sentiment.emotions,
        },
      }).catch(() => {
        // Comment might not exist, ignore
      });
    }

    return NextResponse.json({
      analysis: {
        id: analysis?.id,
        sentiment: sentiment.sentiment,
        score: sentiment.score,
        confidence: sentiment.confidence,
        emotions: sentiment.emotions,
        toneIndicators: sentiment.toneIndicators,
        keyPhrases: sentiment.keyPhrases,
      },
      engagementPrediction,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Sentiment analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze sentiment' },
      { status: 500 }
    );
  }
  });
  }, { allowWithoutKey: true });
}

// ============================================================================
// GET /api/ai-content/sentiment
// Get past analyses
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_READ
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const userId = security.context.userId!;
    const { searchParams } = new URL(request.url);

    const contentType = searchParams.get('contentType');
    const contentId = searchParams.get('contentId');
    const sentiment = searchParams.get('sentiment');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    const where: {
      userId: string;
      contentType?: string;
      contentId?: string;
      sentiment?: string;
    } = { userId };

    if (contentType) where.contentType = contentType;
    if (contentId) where.contentId = contentId;
    if (sentiment) where.sentiment = sentiment;

    const [analyses, total] = await Promise.all([
      (prisma as any).sentimentAnalysis?.findMany({
        where,
        orderBy: { analyzedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          contentType: true,
          contentId: true,
          sentiment: true,
          score: true,
          confidence: true,
          emotions: true,
          platform: true,
          predictedEngagement: true,
          analyzedAt: true,
        },
      }) || [],
      (prisma as any).sentimentAnalysis?.count({ where }) || 0,
    ]);

    return NextResponse.json({
      analyses: analyses || [],
      total: total || 0,
      hasMore: (analyses?.length || 0) === limit,
    });
  } catch (error) {
    logger.error('Get analyses error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analyses' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for AI calls
export const runtime = 'nodejs';
