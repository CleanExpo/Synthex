/**
 * Trending Topics API Route
 *
 * @description Returns trending topics based on:
 * - Post performance
 * - Hashtag frequency
 * - Engagement ratios
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================================================
// TYPES
// ============================================================================

interface TrendingTopic {
  id: string;
  topic: string;
  volume: number;
  change: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

// ============================================================================
// GET /api/trending
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get time range from query params
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch recent posts to analyze content
    const recentPosts = await prisma.post.findMany({
      where: {
        createdAt: { gte: startDate },
        status: { in: ['published', 'scheduled'] },
      },
      select: {
        content: true,
        analytics: true,
        platform: true,
      },
      take: 500,
    });

    // Extract and count hashtags from posts
    const hashtagCounts = new Map<string, { count: number; engagement: number }>();

    recentPosts.forEach((post) => {
      // Extract hashtags from content
      const hashtags = post.content.match(/#\w+/g) || [];
      const analytics = post.analytics as Record<string, number> | null;
      const engagement = analytics?.engagement || analytics?.likes || 0;

      hashtags.forEach((tag) => {
        const normalizedTag = tag.toLowerCase();
        const existing = hashtagCounts.get(normalizedTag) || { count: 0, engagement: 0 };
        hashtagCounts.set(normalizedTag, {
          count: existing.count + 1,
          engagement: existing.engagement + engagement,
        });
      });
    });

    // Convert to array and sort by volume
    const sortedTopics: TrendingTopic[] = Array.from(hashtagCounts.entries())
      .map(([topic, data], index) => ({
        id: `topic-${index}`,
        topic,
        volume: data.count,
        change: calculateChange(data.engagement, data.count),
        sentiment: determineSentiment(data.engagement / Math.max(data.count, 1)),
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);

    // If no hashtags found, return proper empty state
    if (sortedTopics.length === 0) {
      return NextResponse.json({
        data: [],
        message: 'No trending data available yet. Trending topics will appear as content is published and tracked.',
      });
    }

    return NextResponse.json({ data: sortedTopics });
  } catch (error) {
    console.error('Trending topics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trending topics', message: 'An error occurred while analyzing trending data.' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function calculateChange(engagement: number, count: number): number {
  // Deterministic change based on engagement-to-post ratio
  const ratio = engagement / Math.max(count, 1);
  if (ratio > 100) return 50;
  if (ratio > 50) return 25;
  if (ratio > 10) return 8;
  if (ratio > 1) return 2;
  return 0;
}

function determineSentiment(avgEngagement: number): 'positive' | 'neutral' | 'negative' {
  if (avgEngagement > 50) return 'positive';
  if (avgEngagement > 10) return 'neutral';
  return 'negative';
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
