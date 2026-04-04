/**
 * Trend Analyser
 *
 * Analyses scraped social media posts using the platform AI provider
 * and extracts structured TrendInsight records.
 */
import { getAIProvider } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';
import type { ScrapedPost } from './apify/types';
import type { InsightCategory, SupportedPlatform } from './types';

export interface ExtractedInsight {
  platform: SupportedPlatform;
  category: InsightCategory;
  insight: string;
  confidence: number; // 0.0–1.0
  dataPoints: number;
}

const ANALYSIS_PROMPT = (platform: string, postsJson: string) =>
  `You are a social media strategist analysing ${platform} content trends.

Below are ${platform} posts ranked by engagement. Extract actionable content patterns.

POSTS DATA:
${postsJson}

Return a JSON array of insights. Each insight must follow this exact schema:
{
  "category": "hook" | "visual_style" | "hashtag" | "topic" | "format" | "cta",
  "insight": "Concise actionable insight (max 200 chars)",
  "confidence": 0.0-1.0,
  "dataPoints": <number of posts that support this insight>
}

Return ONLY valid JSON array, no other text. Extract 5-10 insights maximum.`;

export async function analyseScrapedPosts(
  platform: SupportedPlatform,
  posts: ScrapedPost[]
): Promise<ExtractedInsight[]> {
  if (posts.length === 0) return [];

  const ai = getAIProvider();

  // Sort by engagement, take top 50 for analysis
  const topPosts = posts
    .sort((a, b) => b.engagementCount - a.engagementCount)
    .slice(0, 50);

  // Summarise posts for AI (avoid huge token cost)
  const postsSummary = topPosts.map(p => ({
    content: p.content.slice(0, 300),
    engagement: p.engagementCount,
    hashtags: p.hashtags?.slice(0, 10),
  }));

  try {
    const response = await ai.complete({
      model: ai.models.balanced,
      messages: [
        {
          role: 'user',
          content: ANALYSIS_PROMPT(
            platform,
            JSON.stringify(postsSummary, null, 2)
          ),
        },
      ],
    });

    const rawJson = response.choices[0]?.message?.content?.trim() ?? '';
    // Strip markdown code fences if present
    const cleaned = rawJson.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(cleaned) as Array<{
      category: InsightCategory;
      insight: string;
      confidence: number;
      dataPoints: number;
    }>;

    return parsed.map(item => ({
      platform,
      category: item.category,
      insight: item.insight,
      confidence: Math.max(0, Math.min(1, item.confidence)),
      dataPoints: item.dataPoints,
    }));
  } catch (err) {
    logger.error('TrendAnalyser: failed to analyse posts', {
      platform,
      error: err,
    });
    return [];
  }
}
