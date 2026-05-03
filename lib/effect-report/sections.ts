/**
 * Effect Report Section Generators — SYN-674
 *
 * Each function fetches and builds one section of the Effect Report.
 * Returns null when insufficient data — section is omitted from the report,
 * never shown as a placeholder. Non-fatal: errors return null, never throw.
 *
 * Sections:
 *   1. achievementSummary  — always built (uses posts table)
 *   2. proprietaryMetrics  — built when any metric is available
 *   3. biggestWin          — built when high-reach post exists in period
 *   4. honestGap           — built when health score with dimensions exists
 *   5. whatsNext           — built with Claude Sonnet narrative
 */

import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { stripHtmlToText } from '@/lib/sanitize';
import type {
  AchievementSummarySection,
  ProprietaryMetricsSection,
  BiggestWinSection,
  HonestGapSection,
  WhatsNextSection,
} from './types';

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
  }
  return _anthropic;
}

// ── Section 1: Achievement Summary ────────────────────────────────────────────

export async function buildAchievementSummary(
  organizationId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<AchievementSummarySection> {
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();

  // Posts published in period
  const postsPublished = await prisma.post
    .count({
      where: {
        deletedAt: null,
        campaign: { organizationId },
        publishedAt: { gte: startIso, lte: endIso },
      },
    } as Parameters<typeof prisma.post.count>[0])
    .catch(() => 0);

  // Total estimated reach
  const reachAgg = await (
    prisma.post.aggregate({
      where: {
        deletedAt: null,
        campaign: { organizationId },
        publishedAt: { gte: startIso, lte: endIso },
        reachCount: { not: null },
      },
      _sum: { reachCount: true },
    } as Parameters<typeof prisma.post.aggregate>[0]) as unknown as Promise<{
      _sum: { reachCount: number | null };
    }>
  ).catch(() => null);

  const estimatedTotalReach = reachAgg?._sum?.reachCount ?? null;

  // Advisor actions taken (recommended actions in period)
  const advisorActionsTaken = await prisma.recommendedAction
    .count({
      where: {
        organizationId,
        weekStart: { gte: periodStart, lte: periodEnd },
      },
    } as Parameters<typeof prisma.recommendedAction.count>[0])
    .catch(() => 0);

  // Consecutive weeks active (posts published in consecutive ISO weeks ending today)
  let consecutiveWeeksActive = 0;
  try {
    const weeklyPosts = await prisma.post.findMany({
      where: {
        deletedAt: null,
        campaign: { organizationId },
        publishedAt: { gte: startIso },
      },
      select: { publishedAt: true },
      orderBy: { publishedAt: 'desc' },
    } as Parameters<typeof prisma.post.findMany>[0]);

    const weekSet = new Set<string>();
    for (const p of weeklyPosts as unknown as { publishedAt: string }[]) {
      const d = new Date(p.publishedAt);
      // ISO week key: YYYY-WW
      const jan4 = new Date(d.getUTCFullYear(), 0, 4);
      const weekNum = Math.ceil(
        ((d.getTime() - jan4.getTime()) / 86400000 + jan4.getUTCDay() + 1) / 7
      );
      weekSet.add(`${d.getUTCFullYear()}-${String(weekNum).padStart(2, '0')}`);
    }

    // Count consecutive weeks backwards from current week
    const now = new Date();
    for (let w = 0; w < 52; w++) {
      const checkDate = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      const jan4 = new Date(checkDate.getUTCFullYear(), 0, 4);
      const weekNum = Math.ceil(
        ((checkDate.getTime() - jan4.getTime()) / 86400000 +
          jan4.getUTCDay() +
          1) /
          7
      );
      const key = `${checkDate.getUTCFullYear()}-${String(weekNum).padStart(2, '0')}`;
      if (!weekSet.has(key)) break;
      consecutiveWeeksActive++;
    }
  } catch {
    // non-fatal
  }

  return {
    postsPublished,
    estimatedTotalReach,
    reviewsResponded: 0, // Reviews feature not yet in Prisma — safe default
    advisorActionsTaken,
    consecutiveWeeksActive,
  };
}

// ── Section 2: Proprietary Metrics Snapshot ───────────────────────────────────

export async function buildProprietaryMetrics(
  organizationId: string,
  admin: SupabaseClient,
  periodStart: Date,
  periodEnd: Date
): Promise<ProprietaryMetricsSection> {
  const quarterAgoStart = new Date(
    periodStart.getTime() - 90 * 24 * 60 * 60 * 1000
  );

  // Health Score (current + previous quarter)
  let healthScore: number | null = null;
  let healthScoreQoQDelta: number | null = null;
  try {
    const scores = await prisma.clientHealthScore.findMany({
      where: { organizationId },
      orderBy: { weekStart: 'desc' },
      take: 16, // enough for current + prior quarter comparison
      select: { overallScore: true, weekStart: true },
    } as Parameters<typeof prisma.clientHealthScore.findMany>[0]);

    const typedScores = scores as unknown as {
      overallScore: number;
      weekStart: Date;
    }[];
    if (typedScores.length >= 1) {
      healthScore = typedScores[0].overallScore;
      // Prior quarter: score closest to periodStart - 90d
      const priorScore = typedScores.find(s => s.weekStart <= quarterAgoStart);
      if (priorScore) {
        healthScoreQoQDelta = healthScore - priorScore.overallScore;
      }
    }
  } catch {
    // non-fatal
  }

  // GEO Score (current + QoQ delta)
  let geoScore: number | null = null;
  let geoScoreQoQDelta: number | null = null;
  try {
    const { data: geoScores } = await (
      admin as ReturnType<
        typeof import('@supabase/supabase-js').createClient<any>
      >
    )
      .from('client_geo_scores')
      .select('overall_score, scored_at')
      .eq('organization_id', organizationId)
      .order('scored_at', { ascending: false })
      .limit(10);

    if (geoScores && geoScores.length >= 1) {
      const typed = geoScores as { overall_score: number; scored_at: string }[];
      geoScore = Math.round(typed[0].overall_score);
      const priorGeo = typed.find(
        s => new Date(s.scored_at) <= quarterAgoStart
      );
      if (priorGeo) {
        geoScoreQoQDelta = Math.round(geoScore - priorGeo.overall_score);
      }
    }
  } catch {
    // non-fatal
  }

  // Attribution — only show if confidence ≥ 0.80 (placeholder: not yet available)
  // SYN-622 gate: attribution validation requires 3 live GA4 clients.
  // Until that gate clears, attribution section is always null.
  const attributionRoi: string | null = null;
  const attributionQoQDelta: string | null = null;

  return {
    healthScore,
    healthScoreQoQDelta,
    geoScore,
    geoScoreQoQDelta,
    attributionRoi,
    attributionQoQDelta,
  };
}

// ── Section 3: Biggest Win ────────────────────────────────────────────────────

export async function buildBiggestWin(
  organizationId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<BiggestWinSection | null> {
  try {
    const startIso = periodStart.toISOString();
    const endIso = periodEnd.toISOString();

    // Best post by reach count in the period
    const topPost = await prisma.post.findFirst({
      where: {
        deletedAt: null,
        campaign: { organizationId },
        publishedAt: { gte: startIso, lte: endIso },
        reachCount: { not: null, gt: 0 },
      },
      orderBy: { reachCount: 'desc' },
      select: { content: true, reachCount: true, publishedAt: true },
    } as Parameters<typeof prisma.post.findFirst>[0]);

    if (!topPost) return null;

    const p = topPost as unknown as {
      content: string | null;
      reachCount: number;
      publishedAt: string;
    };

    const excerpt = p.content
      ? stripHtmlToText(p.content).slice(0, 80)
      : 'This post';

    const metricCount = p.reachCount;
    if (metricCount < 10) return null; // Not worth highlighting under 10 reach

    return {
      date: p.publishedAt.slice(0, 10),
      postExcerpt: excerpt,
      metric: `${metricCount.toLocaleString('en-AU')} estimated views`,
      isAllTime: false,
    };
  } catch {
    return null;
  }
}

// ── Section 4: Honest Gap ─────────────────────────────────────────────────────

const DIMENSION_LABELS: Record<string, string> = {
  content_consistency: 'Content Consistency',
  engagement_trajectory: 'Engagement Trajectory',
  review_responsiveness: 'Review Responsiveness',
  authority_momentum: 'Authority Momentum',
  advisor_engagement: 'Advisor Engagement',
  platform_usage: 'Platform Coverage',
};

const DIMENSION_ACTIONS: Record<string, { action: string; path: string }> = {
  content_consistency: {
    action: 'Post at least 3 times per week to build consistency.',
    path: '/dashboard/autopilot',
  },
  engagement_trajectory: {
    action: 'Reply to comments on your top posts to boost engagement.',
    path: '/dashboard/content',
  },
  review_responsiveness: {
    action: 'Respond to your unanswered Google reviews this week.',
    path: '/dashboard/reviews',
  },
  authority_momentum: {
    action: 'Update your Google Business Profile with fresh photos.',
    path: '/dashboard/authority',
  },
  advisor_engagement: {
    action: "Complete this week's Advisor recommendations.",
    path: '/dashboard/advisor',
  },
  platform_usage: {
    action: 'Connect an additional platform to expand your reach.',
    path: '/dashboard/platforms',
  },
};

export async function buildHonestGap(
  organizationId: string
): Promise<HonestGapSection | null> {
  try {
    const latest = await prisma.clientHealthScore.findFirst({
      where: { organizationId },
      orderBy: { weekStart: 'desc' },
      select: { overallScore: true, dimensions: true },
    } as Parameters<typeof prisma.clientHealthScore.findFirst>[0]);

    if (!latest) return null;

    const l = latest as unknown as {
      overallScore: number;
      dimensions: Record<string, { score: number }>;
    };
    const dims = l.dimensions ?? {};

    let lowestKey = '';
    let lowestScore = Infinity;

    for (const [key, val] of Object.entries(dims)) {
      if (typeof val?.score === 'number' && val.score < lowestScore) {
        lowestScore = val.score;
        lowestKey = key;
      }
    }

    if (!lowestKey || lowestScore === Infinity) return null;

    const label = DIMENSION_LABELS[lowestKey] ?? lowestKey.replace(/_/g, ' ');
    const advice = DIMENSION_ACTIONS[lowestKey] ?? {
      action: 'Review your Synthex recommendations.',
      path: '/dashboard/advisor',
    };

    return {
      dimensionName: label,
      dimensionScore: Math.round(lowestScore),
      overallScore: l.overallScore,
      recommendedAction: advice.action,
      deeplinkPath: advice.path,
    };
  } catch {
    return null;
  }
}

// ── Section 5: What's Next ────────────────────────────────────────────────────

export async function buildWhatsNext(
  organizationId: string,
  businessName: string,
  quarterLabel: string,
  metrics: {
    postsPerWeek: number;
    healthScore: number | null;
    geoScore: number | null;
  }
): Promise<WhatsNextSection | null> {
  try {
    const client = getAnthropic();

    const prompt = `You are a concise marketing analyst writing one forward-looking projection sentence for a client quarterly report.

Client: ${businessName}
Quarter just completed: ${quarterLabel}
Current posting frequency: ~${metrics.postsPerWeek.toFixed(1)} posts/week
${metrics.healthScore !== null ? `Health Score: ${metrics.healthScore}/100` : ''}
${metrics.geoScore !== null ? `GEO Score: ${metrics.geoScore}/100` : ''}

Write ONE sentence following this exact format:
"Based on your current trajectory, Synthex projects [specific outcome] in [next quarter] if you continue at current posting frequency."

The outcome must be specific (include a number range or percentage). Do not use vague language. Do not add any other sentences or explanation.`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b: Anthropic.TextBlock) => b.text)
      .join('')
      .trim();

    if (!text || text.length < 20) return null;

    const basisParts: string[] = [];
    if (metrics.postsPerWeek > 0)
      basisParts.push(`${metrics.postsPerWeek.toFixed(0)} posts/week`);
    if (metrics.healthScore !== null)
      basisParts.push(`Health Score ${metrics.healthScore}/100`);

    return {
      projection: text,
      confidenceBasis:
        basisParts.length > 0
          ? `Based on your ${basisParts.join(', ')} this quarter`
          : 'Based on your activity this quarter',
    };
  } catch {
    return null;
  }
}
