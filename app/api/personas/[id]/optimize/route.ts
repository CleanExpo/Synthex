/**
 * Persona Optimization API Route
 *
 * @description Analyze and optimize persona based on content performance:
 * - GET: Get optimization suggestions
 * - POST: Apply optimization recommendations
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

interface OptimizationSuggestion {
  category: 'tone' | 'style' | 'vocabulary' | 'timing' | 'format';
  current: string;
  suggested: string;
  reason: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
}

interface PerformanceInsight {
  metric: string;
  value: number;
  benchmark: number;
  trend: 'up' | 'down' | 'stable';
  recommendation: string;
}

// ============================================================================
// GET /api/personas/[id]/optimize
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: personaId } = await params;

    // Security check
    const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ);

    if (!security.allowed || !security.context.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = security.context.userId;

    // Get persona with validation
    const persona = await prisma.persona.findFirst({
      where: { id: personaId, userId },
    });

    if (!persona) {
      return NextResponse.json(
        { error: 'Persona not found' },
        { status: 404 }
      );
    }

    // Get posts using this persona (via campaigns)
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      select: { id: true },
    });

    const posts = await prisma.post.findMany({
      where: {
        campaignId: { in: campaigns.map((c) => c.id) },
        status: 'published',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
      },
      select: {
        id: true,
        platform: true,
        analytics: true,
        createdAt: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });

    // Analyze performance
    const insights = analyzePerformance(posts);

    // Generate optimization suggestions
    const suggestions = generateSuggestions(persona, insights);

    // Calculate optimization score
    const optimizationScore = calculateOptimizationScore(persona, insights);

    return NextResponse.json({
      personaId,
      persona: {
        name: persona.name,
        tone: persona.tone,
        style: persona.style,
        vocabulary: persona.vocabulary,
        emotion: persona.emotion,
        accuracy: persona.accuracy,
        lastTrained: persona.lastTrained,
      },
      performance: {
        score: optimizationScore,
        postsAnalyzed: posts.length,
        insights,
      },
      suggestions,
      recommendedActions: suggestions
        .filter((s) => s.impact === 'high')
        .map((s) => ({
          action: `Change ${s.category} from "${s.current}" to "${s.suggested}"`,
          reason: s.reason,
        })),
    });
  } catch (error) {
    logger.error('Optimization analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze optimization' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/personas/[id]/optimize (Apply optimizations)
// ============================================================================

const applyOptimizationsSchema = z.object({
  optimizations: z.array(z.object({
    category: z.string().min(1),
    value: z.string().min(1),
  })).min(1, 'No optimizations provided'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: personaId } = await params;

    // Security check
    const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE);

    if (!security.allowed || !security.context.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = security.context.userId;

    // Verify persona
    const persona = await prisma.persona.findFirst({
      where: { id: personaId, userId },
    });

    if (!persona) {
      return NextResponse.json(
        { error: 'Persona not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const validation = applyOptimizationsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { optimizations } = validation.data;

    // Apply optimizations
    const updates: Record<string, string> = {};
    const applied: string[] = [];

    for (const opt of optimizations) {
      if (opt.category === 'tone' && isValidTone(opt.value)) {
        updates.tone = opt.value;
        applied.push(`tone → ${opt.value}`);
      }
      if (opt.category === 'style' && isValidStyle(opt.value)) {
        updates.style = opt.value;
        applied.push(`style → ${opt.value}`);
      }
      if (opt.category === 'vocabulary' && isValidVocabulary(opt.value)) {
        updates.vocabulary = opt.value;
        applied.push(`vocabulary → ${opt.value}`);
      }
      if (opt.category === 'emotion' && isValidEmotion(opt.value)) {
        updates.emotion = opt.value;
        applied.push(`emotion → ${opt.value}`);
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid optimizations to apply' },
        { status: 400 }
      );
    }

    // Update persona
    await prisma.persona.update({
      where: { id: personaId },
      data: updates,
    });

    return NextResponse.json({
      success: true,
      applied,
      message: `Applied ${applied.length} optimization(s)`,
    });
  } catch (error) {
    logger.error('Optimization apply error:', error);
    return NextResponse.json(
      { error: 'Failed to apply optimizations' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface PostAnalytics {
  analytics: unknown;
  platform: string;
  createdAt: Date;
}

function analyzePerformance(posts: PostAnalytics[]): PerformanceInsight[] {
  const insights: PerformanceInsight[] = [];

  if (posts.length === 0) {
    return [{
      metric: 'data_availability',
      value: 0,
      benchmark: 10,
      trend: 'stable',
      recommendation: 'Publish more content to enable performance analysis',
    }];
  }

  // Calculate average engagement
  let totalEngagement = 0;
  let totalImpressions = 0;

  posts.forEach((post) => {
    const analytics = post.analytics as Record<string, number> | null;
    if (analytics) {
      totalEngagement += analytics.engagement || analytics.likes || 0;
      totalImpressions += analytics.impressions || 0;
    }
  });

  const avgEngagement = totalEngagement / posts.length;
  const avgImpressions = totalImpressions / posts.length;
  const engagementRate = totalImpressions > 0
    ? (totalEngagement / totalImpressions) * 100
    : 0;

  // Engagement rate insight
  insights.push({
    metric: 'engagement_rate',
    value: Math.round(engagementRate * 100) / 100,
    benchmark: 3.5, // Industry average
    trend: engagementRate > 3.5 ? 'up' : engagementRate < 2 ? 'down' : 'stable',
    recommendation: engagementRate < 2
      ? 'Consider adjusting tone to be more engaging or using questions'
      : 'Engagement rate is healthy',
  });

  // Posts per week
  const oldestPost = posts[posts.length - 1];
  const dayRange = Math.ceil(
    (Date.now() - new Date(oldestPost.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const postsPerWeek = (posts.length / dayRange) * 7;

  insights.push({
    metric: 'posting_frequency',
    value: Math.round(postsPerWeek * 10) / 10,
    benchmark: 5, // 5 posts per week
    trend: postsPerWeek > 5 ? 'up' : postsPerWeek < 3 ? 'down' : 'stable',
    recommendation: postsPerWeek < 3
      ? 'Increase posting frequency for better visibility'
      : 'Posting frequency is optimal',
  });

  // Platform diversity
  const platforms = new Set(posts.map((p) => p.platform));
  insights.push({
    metric: 'platform_diversity',
    value: platforms.size,
    benchmark: 3,
    trend: platforms.size >= 3 ? 'up' : 'stable',
    recommendation: platforms.size < 2
      ? 'Consider expanding to more platforms'
      : 'Good platform coverage',
  });

  return insights;
}

function generateSuggestions(
  persona: { tone: string; style: string; vocabulary: string; emotion: string; accuracy: number },
  insights: PerformanceInsight[]
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  // Check engagement rate
  const engagementInsight = insights.find((i) => i.metric === 'engagement_rate');
  if (engagementInsight && engagementInsight.value < 2) {
    // Low engagement - suggest tone changes
    if (persona.tone === 'professional') {
      suggestions.push({
        category: 'tone',
        current: 'professional',
        suggested: 'casual',
        reason: 'Casual tone often drives higher engagement on social media',
        confidence: 0.7,
        impact: 'high',
      });
    }

    if (persona.emotion === 'neutral') {
      suggestions.push({
        category: 'tone',
        current: 'neutral emotion',
        suggested: 'friendly',
        reason: 'Friendly, warm content tends to receive more interactions',
        confidence: 0.75,
        impact: 'medium',
      });
    }
  }

  // Check accuracy
  if (persona.accuracy < 60) {
    suggestions.push({
      category: 'style',
      current: 'undertrained',
      suggested: 'retrain with more samples',
      reason: 'Low accuracy indicates insufficient training data',
      confidence: 0.9,
      impact: 'high',
    });
  }

  // Vocabulary suggestions
  if (persona.vocabulary === 'technical' && engagementInsight && engagementInsight.value < 3) {
    suggestions.push({
      category: 'vocabulary',
      current: 'technical',
      suggested: 'standard',
      reason: 'Simpler vocabulary may reach a broader audience',
      confidence: 0.65,
      impact: 'medium',
    });
  }

  // If no issues found
  if (suggestions.length === 0 && persona.accuracy > 70) {
    suggestions.push({
      category: 'style',
      current: persona.style,
      suggested: persona.style,
      reason: 'Current configuration is performing well - no changes recommended',
      confidence: 0.8,
      impact: 'low',
    });
  }

  return suggestions;
}

function calculateOptimizationScore(
  persona: { accuracy: number },
  insights: PerformanceInsight[]
): number {
  let score = 50; // Base score

  // Add accuracy contribution
  score += (persona.accuracy / 100) * 25;

  // Add insights contribution
  insights.forEach((insight) => {
    if (insight.trend === 'up') score += 5;
    if (insight.trend === 'down') score -= 5;
    if (insight.value >= insight.benchmark) score += 3;
  });

  return Math.max(0, Math.min(100, Math.round(score)));
}

function isValidTone(value: string): boolean {
  return ['professional', 'casual', 'authoritative', 'friendly', 'humorous'].includes(value);
}

function isValidStyle(value: string): boolean {
  return ['formal', 'conversational', 'thought-provoking', 'educational', 'inspirational'].includes(value);
}

function isValidVocabulary(value: string): boolean {
  return ['simple', 'standard', 'technical', 'sophisticated'].includes(value);
}

function isValidEmotion(value: string): boolean {
  return ['neutral', 'friendly', 'confident', 'inspiring', 'empathetic'].includes(value);
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
