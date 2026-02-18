/**
 * GEO Readiness Service
 *
 * Wraps the existing lib/geo/ engine into dashboard-ready functions with:
 * - Readiness tier assessment (ready/almost/needs-work/not-ready)
 * - Readiness summaries per dimension
 * - Platform-specific readiness flags
 * - History tracking via GEOAnalysis model
 * - Score trend aggregation
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { prisma } from '@/lib/prisma';
import { analyzeGEO } from '@/lib/geo/geo-analyzer';
import type { GEOAnalysisResult, GEOPlatform } from '@/lib/geo/types';

// ============================================================================
// TYPES
// ============================================================================

export type ReadinessTier = 'ready' | 'almost' | 'needs-work' | 'not-ready';

export interface ReadinessAssessment {
  tier: ReadinessTier;
  summaries: {
    overall: string;
    citability: string;
    structure: string;
    multiModal: string;
    authority: string;
    technical: string;
  };
  platformReadiness: {
    google_aio: boolean;
    chatgpt: boolean;
    perplexity: boolean;
    bing_copilot: boolean;
  };
}

export interface GeoReadinessResult extends GEOAnalysisResult {
  readiness: ReadinessAssessment;
}

export interface GeoAnalysisHistoryItem {
  id: number;
  contentUrl: string | null;
  platform: string;
  overallScore: number;
  citabilityScore: number;
  structureScore: number;
  multiModalScore: number;
  authorityScore: number;
  technicalScore: number;
  createdAt: string;
}

export interface GeoScoreTrend {
  date: string;
  overall: number;
  citability: number;
  structure: number;
  multiModal: number;
  authority: number;
  technical: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function getReadinessTier(score: number): ReadinessTier {
  if (score >= 80) return 'ready';
  if (score >= 60) return 'almost';
  if (score >= 40) return 'needs-work';
  return 'not-ready';
}

function getScoreSummary(dimension: string, score: number): string {
  const label = score >= 80 ? 'strong' : score >= 60 ? 'good' : score >= 40 ? 'needs improvement' : 'weak';
  return `Your ${dimension} score is ${label} at ${score}/100`;
}

// ============================================================================
// DEMO DATA
// ============================================================================

function getDemoHistory(): GeoAnalysisHistoryItem[] {
  const now = new Date();
  return [
    {
      id: 1,
      contentUrl: 'https://example.com/blog/ai-trends',
      platform: 'all',
      overallScore: 78,
      citabilityScore: 82,
      structureScore: 75,
      multiModalScore: 60,
      authorityScore: 85,
      technicalScore: 72,
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 2,
      contentUrl: 'https://example.com/blog/seo-guide',
      platform: 'google_aio',
      overallScore: 85,
      citabilityScore: 88,
      structureScore: 82,
      multiModalScore: 75,
      authorityScore: 90,
      technicalScore: 80,
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 3,
      contentUrl: null,
      platform: 'chatgpt',
      overallScore: 65,
      citabilityScore: 70,
      structureScore: 68,
      multiModalScore: 40,
      authorityScore: 72,
      technicalScore: 60,
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 4,
      contentUrl: 'https://example.com/research/market-analysis',
      platform: 'perplexity',
      overallScore: 72,
      citabilityScore: 78,
      structureScore: 70,
      multiModalScore: 55,
      authorityScore: 80,
      technicalScore: 68,
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function getDemoTrends(days: number): GeoScoreTrend[] {
  const trends: GeoScoreTrend[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    // Generate realistic-looking trend data with some variation
    const baseScore = 70 + Math.sin(i / 5) * 10;
    trends.push({
      date: date.toISOString().split('T')[0],
      overall: Math.round(baseScore + Math.random() * 5),
      citability: Math.round(baseScore + 5 + Math.random() * 5),
      structure: Math.round(baseScore - 2 + Math.random() * 5),
      multiModal: Math.round(baseScore - 10 + Math.random() * 5),
      authority: Math.round(baseScore + 8 + Math.random() * 5),
      technical: Math.round(baseScore - 5 + Math.random() * 5),
    });
  }

  return trends;
}

// ============================================================================
// READINESS ANALYSIS
// ============================================================================

/**
 * Analyze content for GEO readiness.
 * Wraps the existing GEO engine and adds readiness assessment.
 */
export async function analyzeReadiness(
  contentText: string,
  contentUrl?: string,
  platform: GEOPlatform = 'all'
): Promise<GeoReadinessResult> {
  // Run core GEO analysis
  const result = await analyzeGEO({
    contentText,
    contentUrl,
    platform,
  });

  // Calculate platform-specific readiness (ready if platform score >= 60)
  const platformReadiness = {
    google_aio: false,
    chatgpt: false,
    perplexity: false,
    bing_copilot: false,
  };

  for (const ps of result.platformScores) {
    if (ps.platform !== 'all' && ps.score >= 60) {
      platformReadiness[ps.platform as keyof typeof platformReadiness] = true;
    }
  }

  // Build readiness assessment
  const readiness: ReadinessAssessment = {
    tier: getReadinessTier(result.score.overall),
    summaries: {
      overall: getScoreSummary('overall', result.score.overall),
      citability: getScoreSummary('citability', result.score.citability),
      structure: getScoreSummary('structure', result.score.structure),
      multiModal: getScoreSummary('multi-modal', result.score.multiModal),
      authority: getScoreSummary('authority', result.score.authority),
      technical: getScoreSummary('technical', result.score.technical),
    },
    platformReadiness,
  };

  return {
    ...result,
    readiness,
  };
}

// ============================================================================
// HISTORY
// ============================================================================

/**
 * Get GEO analysis history for a user.
 * Returns recent analyses ordered by createdAt DESC.
 * Falls back to demo data if no records exist.
 */
export async function getAnalysisHistory(
  userId: string,
  limit: number = 20
): Promise<{ analyses: GeoAnalysisHistoryItem[]; total: number; isDemo: boolean }> {
  const analyses = await prisma.gEOAnalysis.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      contentUrl: true,
      platform: true,
      overallScore: true,
      citabilityScore: true,
      structureScore: true,
      multiModalScore: true,
      authorityScore: true,
      technicalScore: true,
      createdAt: true,
    },
    take: Math.min(limit, 100),
  });

  if (analyses.length === 0) {
    const demoData = getDemoHistory();
    return {
      analyses: demoData,
      total: demoData.length,
      isDemo: true,
    };
  }

  const formattedAnalyses: GeoAnalysisHistoryItem[] = analyses.map((a) => ({
    id: a.id,
    contentUrl: a.contentUrl,
    platform: a.platform,
    overallScore: a.overallScore,
    citabilityScore: a.citabilityScore,
    structureScore: a.structureScore,
    multiModalScore: a.multiModalScore,
    authorityScore: a.authorityScore,
    technicalScore: a.technicalScore,
    createdAt: a.createdAt.toISOString(),
  }));

  return {
    analyses: formattedAnalyses,
    total: formattedAnalyses.length,
    isDemo: false,
  };
}

// ============================================================================
// TRENDS
// ============================================================================

/**
 * Get GEO score trends aggregated by date.
 * Returns daily average scores for all dimensions.
 * Falls back to demo data if no records exist.
 */
export async function getScoreTrends(
  userId: string,
  days: number = 30
): Promise<{ trends: GeoScoreTrend[]; period: { start: string; end: string; days: number }; isDemo: boolean }> {
  const actualDays = Math.min(Math.max(days, 1), 90);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - actualDays);
  const endDate = new Date();

  const analyses = await prisma.gEOAnalysis.findMany({
    where: {
      userId,
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      createdAt: true,
      overallScore: true,
      citabilityScore: true,
      structureScore: true,
      multiModalScore: true,
      authorityScore: true,
      technicalScore: true,
    },
  });

  if (analyses.length === 0) {
    const demoTrends = getDemoTrends(actualDays);
    return {
      trends: demoTrends,
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days: actualDays,
      },
      isDemo: true,
    };
  }

  // Group by date and calculate averages
  const byDate = new Map<string, {
    count: number;
    overall: number;
    citability: number;
    structure: number;
    multiModal: number;
    authority: number;
    technical: number;
  }>();

  for (const a of analyses) {
    const dateKey = a.createdAt.toISOString().split('T')[0];
    const existing = byDate.get(dateKey) || {
      count: 0,
      overall: 0,
      citability: 0,
      structure: 0,
      multiModal: 0,
      authority: 0,
      technical: 0,
    };

    existing.count += 1;
    existing.overall += a.overallScore;
    existing.citability += a.citabilityScore;
    existing.structure += a.structureScore;
    existing.multiModal += a.multiModalScore;
    existing.authority += a.authorityScore;
    existing.technical += a.technicalScore;

    byDate.set(dateKey, existing);
  }

  const trends: GeoScoreTrend[] = [];
  for (const [date, data] of byDate.entries()) {
    trends.push({
      date,
      overall: Math.round(data.overall / data.count),
      citability: Math.round(data.citability / data.count),
      structure: Math.round(data.structure / data.count),
      multiModal: Math.round(data.multiModal / data.count),
      authority: Math.round(data.authority / data.count),
      technical: Math.round(data.technical / data.count),
    });
  }

  // Sort by date ascending
  trends.sort((a, b) => a.date.localeCompare(b.date));

  return {
    trends,
    period: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
      days: actualDays,
    },
    isDemo: false,
  };
}
