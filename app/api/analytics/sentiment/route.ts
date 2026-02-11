/**
 * Sentiment Analytics API Route
 *
 * @description Analytics and trends for sentiment data:
 * - GET: Get sentiment trends and insights
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 *
 * FAILURE MODE: Returns 500 on database errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

/** Sentiment analysis record from database */
interface SentimentAnalysisRecord {
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  score: number | null;
  confidence: number | null;
  emotions: EmotionRecord[] | null;
  platform: string | null;
  analyzedAt: Date | string;
  predictedEngagement: Record<string, unknown> | null;
  actualEngagement: { engagementRate?: number } | null;
}

/** Emotion record within sentiment analysis */
interface EmotionRecord {
  emotion: string;
  score?: number;
}

/** Where clause for sentiment analysis query */
interface SentimentWhereClause {
  userId: string;
  analyzedAt: { gte: Date };
  platform?: string;
}

/** Extended prisma client with sentimentAnalysis table */
interface PrismaWithSentiment {
  sentimentAnalysis?: {
    findMany: (args: Record<string, unknown>) => Promise<SentimentAnalysisRecord[]>;
  };
}

// ============================================================================
// GET /api/analytics/sentiment
// Get sentiment trends and insights
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

    const platform = searchParams.get('platform');
    const days = parseInt(searchParams.get('days') || '30', 10);
    const groupBy = searchParams.get('groupBy') || 'day'; // day, week, platform

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build query
    const where: SentimentWhereClause = {
      userId,
      analyzedAt: { gte: startDate },
    };

    if (platform) {
      where.platform = platform;
    }

    // Get all analyses for the period
    const analyses: SentimentAnalysisRecord[] = await (prisma as unknown as PrismaWithSentiment).sentimentAnalysis?.findMany({
      where,
      select: {
        sentiment: true,
        score: true,
        confidence: true,
        emotions: true,
        platform: true,
        analyzedAt: true,
        predictedEngagement: true,
        actualEngagement: true,
      },
      orderBy: { analyzedAt: 'asc' },
    }) || [];

    // Calculate overall statistics
    const overall = {
      total: analyses.length,
      positive: analyses.filter((a) => a.sentiment === 'positive').length,
      neutral: analyses.filter((a) => a.sentiment === 'neutral').length,
      negative: analyses.filter((a) => a.sentiment === 'negative').length,
      mixed: analyses.filter((a) => a.sentiment === 'mixed').length,
      avgScore: analyses.length > 0
        ? Math.round(analyses.reduce((sum, a) => sum + (a.score || 0), 0) / analyses.length)
        : 0,
      avgConfidence: analyses.length > 0
        ? Math.round((analyses.reduce((sum, a) => sum + (a.confidence || 0), 0) / analyses.length) * 100) / 100
        : 0,
    };

    // Group by time period
    const trendMap = new Map<string, {
      date: string;
      count: number;
      positive: number;
      neutral: number;
      negative: number;
      mixed: number;
      totalScore: number;
    }>();

    for (const analysis of analyses) {
      let key: string;
      const date = new Date(analysis.analyzedAt);

      if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (groupBy === 'platform') {
        key = analysis.platform || 'unknown';
      } else {
        key = date.toISOString().split('T')[0];
      }

      if (!trendMap.has(key)) {
        trendMap.set(key, {
          date: key,
          count: 0,
          positive: 0,
          neutral: 0,
          negative: 0,
          mixed: 0,
          totalScore: 0,
        });
      }

      const entry = trendMap.get(key)!;
      entry.count++;
      entry.totalScore += analysis.score || 0;

      switch (analysis.sentiment) {
        case 'positive':
          entry.positive++;
          break;
        case 'neutral':
          entry.neutral++;
          break;
        case 'negative':
          entry.negative++;
          break;
        case 'mixed':
          entry.mixed++;
          break;
      }
    }

    const trends = Array.from(trendMap.values())
      .map((entry) => ({
        ...entry,
        avgScore: entry.count > 0 ? Math.round(entry.totalScore / entry.count) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Aggregate emotions
    const emotionCounts: Record<string, number> = {};
    for (const analysis of analyses) {
      const emotions: EmotionRecord[] = analysis.emotions || [];
      for (const emotion of emotions) {
        if (emotion?.emotion) {
          emotionCounts[emotion.emotion] = (emotionCounts[emotion.emotion] || 0) + 1;
        }
      }
    }

    const topEmotions = Object.entries(emotionCounts)
      .sort(([, a]: [string, number], [, b]: [string, number]) => b - a)
      .slice(0, 8)
      .map(([emotion, count]) => ({
        emotion,
        count,
        percentage: Math.round((count / analyses.length) * 100),
      }));

    // Platform breakdown
    const platformBreakdown: Record<string, { count: number; avgScore: number; positive: number; negative: number }> = {};
    for (const analysis of analyses) {
      const plat = analysis.platform || 'unknown';
      if (!platformBreakdown[plat]) {
        platformBreakdown[plat] = { count: 0, avgScore: 0, positive: 0, negative: 0 };
      }
      platformBreakdown[plat].count++;
      platformBreakdown[plat].avgScore += analysis.score || 0;
      if (analysis.sentiment === 'positive') platformBreakdown[plat].positive++;
      if (analysis.sentiment === 'negative') platformBreakdown[plat].negative++;
    }

    for (const plat of Object.keys(platformBreakdown)) {
      const data = platformBreakdown[plat];
      data.avgScore = data.count > 0 ? Math.round(data.avgScore / data.count) : 0;
    }

    // Engagement correlation (if we have actual engagement data)
    const withEngagement = analyses.filter((a) => a.actualEngagement);
    let engagementCorrelation = null;

    if (withEngagement.length >= 10) {
      const positiveEng = withEngagement
        .filter((a) => a.sentiment === 'positive')
        .map((a) => a.actualEngagement?.engagementRate || 0);
      const negativeEng = withEngagement
        .filter((a) => a.sentiment === 'negative')
        .map((a) => a.actualEngagement?.engagementRate || 0);

      engagementCorrelation = {
        positiveAvgEngagement: positiveEng.length > 0
          ? Math.round((positiveEng.reduce((a, b) => a + b, 0) / positiveEng.length) * 100) / 100
          : null,
        negativeAvgEngagement: negativeEng.length > 0
          ? Math.round((negativeEng.reduce((a, b) => a + b, 0) / negativeEng.length) * 100) / 100
          : null,
        sampleSize: withEngagement.length,
      };
    }

    // Insights
    const insights: string[] = [];

    if (overall.positive > overall.negative * 2) {
      insights.push('Your content has predominantly positive sentiment. This typically correlates with higher engagement.');
    } else if (overall.negative > overall.positive) {
      insights.push('Your content has more negative sentiment than positive. Consider adjusting tone for better audience reception.');
    }

    const recentAnalyses = analyses.slice(-10);
    const recentAvgScore = recentAnalyses.length > 0
      ? recentAnalyses.reduce((sum, a) => sum + (a.score || 0), 0) / recentAnalyses.length
      : 0;

    if (recentAvgScore > overall.avgScore + 10) {
      insights.push('Recent content shows improving sentiment. Keep up the positive momentum!');
    } else if (recentAvgScore < overall.avgScore - 10) {
      insights.push('Recent content shows declining sentiment. Review your recent posts for potential issues.');
    }

    if (topEmotions.length > 0 && topEmotions[0].emotion === 'joy') {
      insights.push(`Joy is your most common emotion (${topEmotions[0].percentage}% of content). This typically drives shares and saves.`);
    }

    return NextResponse.json({
      period: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        days,
      },
      overall,
      trends,
      topEmotions,
      platformBreakdown,
      engagementCorrelation,
      insights,
    });
  } catch (error) {
    console.error('Sentiment analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sentiment analytics' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
