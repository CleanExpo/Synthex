/**
 * Sentiment Analyzer for Social Mentions
 *
 * @description Analyzes sentiment of text content using AI.
 * Returns sentiment classification (positive/negative/neutral) and score.
 *
 * Implementation priority:
 * 1. OpenRouter with fast model (claude-3-haiku)
 * 2. Simple keyword-based fallback
 */

import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number; // -1.0 to 1.0
  confidence: number; // 0.0 to 1.0
}

export interface BatchSentimentResult {
  results: Array<SentimentResult & { text: string; index: number }>;
  success: boolean;
  error?: string;
}

// ============================================================================
// Keyword-based Fallback
// ============================================================================

const POSITIVE_WORDS = new Set([
  'love', 'great', 'amazing', 'awesome', 'excellent', 'fantastic', 'wonderful',
  'best', 'good', 'happy', 'beautiful', 'perfect', 'incredible', 'brilliant',
  'outstanding', 'superb', 'impressive', 'delightful', 'terrific', 'fabulous',
  'nice', 'cool', 'helpful', 'useful', 'recommend', 'thanks', 'thank',
  'appreciate', 'excited', 'glad', 'pleased', 'enjoyed', 'favorite', 'favourite',
]);

const NEGATIVE_WORDS = new Set([
  'hate', 'bad', 'terrible', 'awful', 'horrible', 'worst', 'poor', 'disappointed',
  'disappointing', 'frustrating', 'annoying', 'angry', 'upset', 'sad', 'broken',
  'fail', 'failed', 'failure', 'useless', 'waste', 'scam', 'fraud', 'fake',
  'sucks', 'pathetic', 'ridiculous', 'disgusting', 'unacceptable', 'regret',
  'avoid', 'problem', 'issue', 'bug', 'error', 'crash', 'slow', 'expensive',
]);

function analyzeWithKeywords(text: string): SentimentResult {
  const words = text.toLowerCase().split(/\W+/);
  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) positiveCount++;
    if (NEGATIVE_WORDS.has(word)) negativeCount++;
  }

  const total = positiveCount + negativeCount;

  if (total === 0) {
    return { sentiment: 'neutral', score: 0, confidence: 0.3 };
  }

  const score = (positiveCount - negativeCount) / total;
  const confidence = Math.min(total / 5, 1) * 0.6; // Max 0.6 confidence for keyword-based

  if (score > 0.2) {
    return { sentiment: 'positive', score: Math.min(score, 1), confidence };
  } else if (score < -0.2) {
    return { sentiment: 'negative', score: Math.max(score, -1), confidence };
  }

  return { sentiment: 'neutral', score, confidence };
}

// ============================================================================
// AI-based Analysis
// ============================================================================

async function analyzeWithAI(text: string): Promise<SentimentResult | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social',
        'X-Title': 'Synthex Sentiment Analysis',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku-20240307',
        messages: [
          {
            role: 'system',
            content: `You are a sentiment analyzer. Analyze the sentiment of the given text and respond with ONLY a JSON object in this exact format:
{"sentiment": "positive|negative|neutral", "score": <number from -1 to 1>, "confidence": <number from 0 to 1>}

Score guidelines:
- positive: 0.3 to 1.0
- neutral: -0.3 to 0.3
- negative: -1.0 to -0.3

Confidence guidelines:
- High confidence (0.8-1.0): Clear sentiment with strong language
- Medium confidence (0.5-0.8): Mixed signals or moderate language
- Low confidence (0.3-0.5): Ambiguous or unclear sentiment`,
          },
          {
            role: 'user',
            content: text.slice(0, 500), // Limit input size
          },
        ],
        max_tokens: 100,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      logger.warn('[sentiment-analyzer] OpenRouter API error', { status: response.status });
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return null;
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validate and normalize
    const sentiment = ['positive', 'negative', 'neutral'].includes(result.sentiment)
      ? result.sentiment as 'positive' | 'negative' | 'neutral'
      : 'neutral';
    const score = Math.max(-1, Math.min(1, Number(result.score) || 0));
    const confidence = Math.max(0, Math.min(1, Number(result.confidence) || 0.5));

    return { sentiment, score, confidence };
  } catch (err) {
    logger.warn('[sentiment-analyzer] AI analysis failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Analyze sentiment of a single text.
 * Uses AI if available, falls back to keyword-based analysis.
 */
export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  if (!text || text.trim().length === 0) {
    return { sentiment: 'neutral', score: 0, confidence: 0.1 };
  }

  // Try AI first
  const aiResult = await analyzeWithAI(text);
  if (aiResult) {
    return aiResult;
  }

  // Fall back to keyword-based
  return analyzeWithKeywords(text);
}

/**
 * Analyze sentiment of multiple texts in batch.
 * More efficient than individual calls when processing many items.
 */
export async function analyzeSentimentBatch(
  texts: string[],
  maxConcurrent: number = 5
): Promise<BatchSentimentResult> {
  if (texts.length === 0) {
    return { results: [], success: true };
  }

  const results: Array<SentimentResult & { text: string; index: number }> = [];

  // Process in chunks to avoid rate limiting
  for (let i = 0; i < texts.length; i += maxConcurrent) {
    const chunk = texts.slice(i, i + maxConcurrent);
    const chunkResults = await Promise.all(
      chunk.map(async (text, chunkIndex) => {
        const index = i + chunkIndex;
        try {
          const result = await analyzeSentiment(text);
          return { ...result, text, index };
        } catch (err) {
          // Return neutral on error
          return {
            sentiment: 'neutral' as const,
            score: 0,
            confidence: 0.1,
            text,
            index,
          };
        }
      })
    );
    results.push(...chunkResults);
  }

  // Sort by original index
  results.sort((a, b) => a.index - b.index);

  return { results, success: true };
}

/**
 * Quick sentiment check using keywords only (no AI).
 * Use when speed is more important than accuracy.
 */
export function analyzeSentimentQuick(text: string): SentimentResult {
  return analyzeWithKeywords(text);
}
