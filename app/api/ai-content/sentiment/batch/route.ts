/**
 * Batch Sentiment Analysis API Route
 *
 * @description Analyze multiple texts in batch:
 * - POST: Batch analyze texts
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - OPENROUTER_API_KEY: AI service key (SECRET)
 *
 * FAILURE MODE: Returns partial results on individual failures
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { z } from 'zod';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const batchAnalyzeSchema = z.object({
  items: z.array(z.object({
    id: z.string().optional(),
    text: z.string().min(1).max(5000),
    contentType: z.enum(['post', 'comment', 'campaign', 'text']).default('text'),
    contentId: z.string().optional(),
    platform: z.string().optional(),
  })).min(1).max(50),
  updateComments: z.boolean().default(true),
});

// ============================================================================
// TYPES
// ============================================================================

interface BatchResult {
  id?: string;
  contentId?: string;
  sentiment: string;
  score: number;
  confidence: number;
  emotions: { emotion: string; intensity: number }[];
  error?: string;
}

// ============================================================================
// SENTIMENT ANALYSIS (Simplified for batch)
// ============================================================================

async function analyzeBatch(
  texts: string[]
): Promise<{ sentiment: string; score: number; confidence: number; emotions: any[] }[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || texts.length > 20) {
    // Use rule-based for large batches or no API key
    return texts.map((text) => analyzeWithRules(text));
  }

  try {
    // Batch request to AI
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [
          {
            role: 'system',
            content: `Analyze sentiment for multiple texts. For each text, return:
- sentiment: "positive", "neutral", "negative", or "mixed"
- score: -100 to 100
- confidence: 0 to 1
- emotions: array of { emotion, intensity }

Return a JSON array with one result per input text. Return ONLY valid JSON array.`,
          },
          {
            role: 'user',
            content: JSON.stringify(texts.map((t, i) => ({ index: i, text: t.substring(0, 500) }))),
          },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error('AI request failed');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON array
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const results = JSON.parse(jsonMatch[0]);
      return results.map((r: any) => ({
        sentiment: r.sentiment || 'neutral',
        score: Math.max(-100, Math.min(100, r.score || 0)),
        confidence: Math.max(0, Math.min(1, r.confidence || 0.5)),
        emotions: r.emotions || [],
      }));
    }

    throw new Error('Failed to parse batch response');
  } catch (error) {
    console.error('Batch AI analysis failed:', error);
    return texts.map((text) => analyzeWithRules(text));
  }
}

/**
 * Rule-based sentiment analysis
 */
function analyzeWithRules(text: string): { sentiment: string; score: number; confidence: number; emotions: any[] } {
  const lowerText = text.toLowerCase();

  const positiveWords = ['love', 'great', 'amazing', 'awesome', 'excellent', 'fantastic', 'wonderful', 'happy', 'excited', 'best', 'good', 'brilliant'];
  const negativeWords = ['hate', 'terrible', 'awful', 'horrible', 'bad', 'worst', 'disappointing', 'sad', 'angry', 'frustrated', 'poor', 'fail'];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of positiveWords) {
    if (lowerText.includes(word)) positiveCount++;
  }
  for (const word of negativeWords) {
    if (lowerText.includes(word)) negativeCount++;
  }

  const total = positiveCount + negativeCount;
  let score = 0;
  let sentiment = 'neutral';

  if (total > 0) {
    score = ((positiveCount - negativeCount) / total) * 100;
    if (positiveCount > 0 && negativeCount > 0) {
      sentiment = 'mixed';
    } else if (score > 20) {
      sentiment = 'positive';
    } else if (score < -20) {
      sentiment = 'negative';
    }
  }

  const emotions: { emotion: string; intensity: number }[] = [];
  if (lowerText.match(/happy|joy|excited/)) emotions.push({ emotion: 'joy', intensity: 0.7 });
  if (lowerText.match(/sad|disappointed/)) emotions.push({ emotion: 'sadness', intensity: 0.7 });
  if (lowerText.match(/angry|frustrated/)) emotions.push({ emotion: 'anger', intensity: 0.7 });

  return {
    sentiment,
    score: Math.round(score),
    confidence: total > 2 ? 0.6 : 0.4,
    emotions,
  };
}

// ============================================================================
// POST /api/ai-content/sentiment/batch
// Batch analyze texts
// ============================================================================

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
        401
      );
    }

    const userId = security.context.userId!;
    const body = await request.json();

    // Validate input
    const validation = batchAnalyzeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { items, updateComments } = validation.data;

    // Analyze all texts
    const texts = items.map((item) => item.text);
    const sentiments = await analyzeBatch(texts);

    // Build results and store
    const results: BatchResult[] = [];
    const commentUpdates: { id: string; sentiment: string; score: number; emotions: any }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const sentiment = sentiments[i];

      results.push({
        id: item.id,
        contentId: item.contentId,
        sentiment: sentiment.sentiment,
        score: sentiment.score,
        confidence: sentiment.confidence,
        emotions: sentiment.emotions,
      });

      // Queue comment updates
      if (updateComments && item.contentType === 'comment' && item.contentId) {
        commentUpdates.push({
          id: item.contentId,
          sentiment: sentiment.sentiment,
          score: sentiment.score,
          emotions: sentiment.emotions,
        });
      }
    }

    // Batch store analyses
    const analysesToCreate = items.map((item, i) => ({
      userId,
      contentType: item.contentType,
      contentId: item.contentId,
      text: item.text.substring(0, 2000),
      sentiment: sentiments[i].sentiment,
      score: sentiments[i].score,
      confidence: sentiments[i].confidence,
      emotions: sentiments[i].emotions,
      platform: item.platform,
      model: process.env.OPENROUTER_API_KEY ? 'claude-3-haiku' : 'rule-based',
    }));

    await (prisma as any).sentimentAnalysis?.createMany({
      data: analysesToCreate,
    }).catch((err: any) => {
      console.error('Failed to store batch analyses:', err);
    });

    // Update comments with sentiment
    if (commentUpdates.length > 0) {
      for (const update of commentUpdates) {
        await (prisma as any).contentComment?.update({
          where: { id: update.id },
          data: {
            sentiment: update.sentiment,
            sentimentScore: update.score,
            emotions: update.emotions,
          },
        }).catch(() => {
          // Ignore individual update failures
        });
      }
    }

    // Calculate summary statistics
    const summary = {
      total: results.length,
      positive: results.filter((r) => r.sentiment === 'positive').length,
      neutral: results.filter((r) => r.sentiment === 'neutral').length,
      negative: results.filter((r) => r.sentiment === 'negative').length,
      mixed: results.filter((r) => r.sentiment === 'mixed').length,
      avgScore: Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length),
      avgConfidence: Math.round((results.reduce((sum, r) => sum + r.confidence, 0) / results.length) * 100) / 100,
    };

    return NextResponse.json({
      results,
      summary,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Batch sentiment analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze batch' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for AI calls
export const runtime = 'nodejs';
