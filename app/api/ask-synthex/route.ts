/**
 * POST /api/ask-synthex
 *
 * Ask Synthex Anything — Track A SQL retrieval backend (SYN-681)
 *
 * Handles conversational questions about a client's marketing performance.
 * Routes to Haiku/Sonnet/Opus based on question complexity, queries five
 * structured data sources, and returns a grounded, source-cited answer.
 *
 * Feature flag: ENABLE_ASK_SYNTHEX_CLIENT_ROLLOUT
 *   - 'true'  → available to all authenticated clients
 *   - absent / 'false' → 403 for non-admin users (14-day internal review period)
 *
 * Can be called:
 *   a) Directly by the UI (user session cookie)
 *   b) Via the `client-context-query` Edge Function (X-Cron-Secret header)
 *
 * @task SYN-681
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import { withRateLimit } from '@/lib/rate-limit/rate-limiter';
import { routedCall } from '@/lib/ai/model-router';
import {
  recordScoreIssued,
  type ScoreLedgerResult,
} from '@/lib/intelligence/accuracy-ledger';
import { tableUnavailable } from '@/lib/api/not-provisioned';
import type { AuthContext } from '@/lib/auth/with-auth';

// ── Feature flag ──────────────────────────────────────────────────────────────

function isFeatureEnabled(isAdmin: boolean): boolean {
  const flag = process.env.ENABLE_ASK_SYNTHEX_CLIENT_ROLLOUT;
  if (flag === 'true') return true;
  return isAdmin; // always available to admins during review period
}

// ── Not-provisioned stores ────────────────────────────────────────────────────

// journey_analytics, client_conversations and conversation_events have no model
// in prisma/schema.prisma. The answer itself is built from Prisma-backed sources,
// so the route still answers, but it states in every response that journey
// context was not consulted and that the conversation was not persisted, instead
// of pretending either happened.
const NOT_PROVISIONED = {
  journeyAnalytics: {
    available: false,
    reason: 'journey_analytics table is not provisioned',
  },
  conversationLog: {
    available: false,
    reason:
      'client_conversations and conversation_events tables are not provisioned; this conversation was not saved',
  },
} as const;

// ── Request validation ────────────────────────────────────────────────────────

// `organizationId` is sourced exclusively from auth.clientId — the previous
// optional `clientId` body field was removed in the service-role leak fix 3/N
// because `owner` is per-organisation (not platform-wide), so an owner of
// org A could pass org B's id and ask-synthex would query/write against
// org B via the service-role admin client (which bypasses RLS).
const AskSynthexSchema = z.object({
  question: z.string().min(1).max(2000),
});

// ── Question complexity classifier ───────────────────────────────────────────

type ConversationTier = 'simple' | 'synthesis' | 'strategy';

const STRATEGY_SIGNALS = [
  'opportunity',
  'quarter',
  'strategy',
  'grow',
  'improve',
  'plan',
  'should i',
  'recommend',
  'advice',
  'roadmap',
  'long-term',
];
const SYNTHESIS_SIGNALS = [
  'why',
  'compare',
  'analyse',
  'analyze',
  'trend',
  'drop',
  'fell',
  'increase',
  'pattern',
  'versus',
  'vs',
  'best',
  'worst',
  'across',
];

function classifyQuestion(question: string): ConversationTier {
  const lower = question.toLowerCase();
  if (STRATEGY_SIGNALS.some(s => lower.includes(s))) return 'strategy';
  if (SYNTHESIS_SIGNALS.some(s => lower.includes(s))) return 'synthesis';
  if (question.split(' ').length > 15) return 'synthesis'; // long questions → multi-signal
  return 'simple';
}

function tierToTaskType(tier: ConversationTier) {
  if (tier === 'strategy') return 'conversation_query_strategy' as const;
  if (tier === 'synthesis') return 'conversation_query_synthesis' as const;
  return 'conversation_query_simple' as const;
}

function tierToModelTier(tier: ConversationTier): 'haiku' | 'sonnet' | 'opus' {
  if (tier === 'strategy') return 'opus';
  if (tier === 'synthesis') return 'sonnet';
  return 'haiku';
}

// ── Context retrieval ─────────────────────────────────────────────────────────

interface DataSource {
  table: string;
  rowsQueried: number;
  confidence: 'High' | 'Medium' | 'Low';
  summary: string;
}

async function retrieveClientContext(
  organizationId: string
): Promise<{ context: string; sources: DataSource[]; postCount: number }> {
  const sources: DataSource[] = [];
  const contextParts: string[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  // 1. Content Performance Profiles — via PlatformPost + PlatformMetrics
  const recentPosts = await prisma.platformPost.findMany({
    where: {
      connection: { organizationId },
      createdAt: { gte: cutoff },
      status: 'published',
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      connection: { select: { platform: true } },
      metrics: {
        select: { impressions: true, engagementRate: true },
        take: 1,
        orderBy: { recordedAt: 'desc' },
      },
    },
  });

  const postCount = recentPosts.length;

  if (postCount > 0) {
    const allMetrics = recentPosts.flatMap(p => p.metrics);
    const avgEngRate =
      allMetrics.length > 0
        ? allMetrics.reduce(
            (sum: number, m) => sum + (m.engagementRate ?? 0),
            0
          ) / allMetrics.length
        : 0;
    const avgImpressions =
      allMetrics.length > 0
        ? allMetrics.reduce((sum: number, m) => sum + (m.impressions ?? 0), 0) /
          allMetrics.length
        : 0;
    const platforms = [
      ...new Set(recentPosts.map(p => p.connection.platform).filter(Boolean)),
    ];

    contextParts.push(
      `Content Performance (last 90 days, ${postCount} posts):` +
        ` avg ${(avgEngRate * 100).toFixed(1)}% engagement rate, avg ${Math.round(avgImpressions)} impressions.` +
        ` Active platforms: ${platforms.join(', ')}.`
    );
    sources.push({
      table: 'platform_posts',
      rowsQueried: postCount,
      confidence: postCount >= 15 ? 'High' : postCount >= 5 ? 'Medium' : 'Low',
      summary: `${postCount} posts across ${platforms.length} platform(s)`,
    });
  }

  // 2. Health Score
  const healthScore = await prisma.clientHealthScore.findFirst({
    where: { organizationId },
    orderBy: { weekStart: 'desc' },
    select: { overallScore: true, dimensions: true, weekStart: true },
  });

  if (healthScore) {
    contextParts.push(
      `Health Score: ${healthScore.overallScore}/100` +
        (healthScore.dimensions
          ? ` (dimensions: ${JSON.stringify(healthScore.dimensions)})`
          : '')
    );
    sources.push({
      table: 'client_health_scores',
      rowsQueried: 1,
      confidence: 'High',
      summary: `Health Score ${healthScore.overallScore}/100`,
    });
  }

  // 3. GEO Score — extract from health score dimensions JSON if present
  if (healthScore?.dimensions) {
    const dims = healthScore.dimensions as Record<string, { score?: number }>;
    const geoSignal = dims['geo_score'] ?? dims['geoScore'];
    if (geoSignal?.score != null) {
      contextParts.push(`GEO Score dimension: ${geoSignal.score}/100`);
      sources.push({
        table: 'client_health_scores',
        rowsQueried: 0, // already counted above
        confidence: 'Medium',
        summary: `GEO Score ${geoSignal.score}/100`,
      });
    }
  }

  // 4. Recommended Actions (last 4 weeks)
  const actionCutoff = new Date();
  actionCutoff.setDate(actionCutoff.getDate() - 28);
  const advisorBriefs = await prisma.recommendedAction.findMany({
    where: { organizationId, weekStart: { gte: actionCutoff } },
    orderBy: { weekStart: 'desc' },
    take: 3,
    select: { actions: true, weekStart: true },
  });

  if (advisorBriefs.length > 0) {
    contextParts.push(
      `Recent AI Advisor briefs (last 4 weeks): ${advisorBriefs.length} brief(s) issued.`
    );
    sources.push({
      table: 'recommended_actions',
      rowsQueried: advisorBriefs.length,
      confidence: 'Medium',
      summary: `${advisorBriefs.length} recent advisor briefs`,
    });
  }

  // 5. Journey engagement — not provisioned (see NOT_PROVISIONED.journeyAnalytics)

  return {
    context: contextParts.join('\n'),
    sources,
    postCount,
  };
}

// ── AI call ───────────────────────────────────────────────────────────────────

async function callAI(
  question: string,
  contextBlock: string,
  tier: ConversationTier,
  postCount: number
): Promise<string> {
  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer':
        process.env.OPENROUTER_SITE_URL ?? 'https://synthex.social',
      'X-Title': process.env.OPENROUTER_SITE_NAME ?? 'Synthex',
    },
  });

  const belowThreshold = postCount < 15;
  const systemPrompt = [
    'You are Synthex, an AI marketing intelligence assistant for Australian small businesses.',
    "You answer questions about marketing performance using the client's real data.",
    'Be specific, cite numbers from the data, and keep answers under 150 words.',
    'Use Australian English. Be direct and practical — SMB owners need action, not theory.',
    belowThreshold
      ? `\nNote: Synthex has ${postCount} posts to learn from — answers improve as the post history grows. Base answers on algorithm knowledge where client data is limited.`
      : '',
    '',
    'CLIENT DATA:',
    contextBlock || 'No data available yet.',
  ]
    .filter(Boolean)
    .join('\n');

  return await routedCall({
    task: {
      taskType: tierToTaskType(tier),
      inputTokenEstimate: systemPrompt.length / 4 + question.length / 4,
      qualityThreshold: tier === 'simple' ? 'medium' : 'high',
    },
    execute: async modelId => {
      const response = await client.messages.create({
        model: modelId,
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }],
      });
      const block = response.content[0];
      if (block.type !== 'text') throw new Error('Unexpected response type');
      return block.text;
    },
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────

// RA-3024 — wrapped in `withRateLimit` so a compromised authenticated
// session cannot issue unbounded Claude calls. The withRateLimit gate
// is tier-aware (free/pro/scale caps resolved from Organization.subscriptionTier);
// the existing withAuth gate stays — both must pass for the handler to run.
const _postHandler = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    const startMs = Date.now();

    // Feature flag check
    // During the 14-day review period (flag=false), only org owners can access
    // (collaborators get 403). When flag=true, all authenticated clients can access.
    const isOwner = auth.role === 'owner';

    if (!isFeatureEnabled(isOwner)) {
      return NextResponse.json(
        {
          error: 'feature_not_enabled',
          message: 'Ask Synthex is not yet available for your account.',
        },
        { status: 403 }
      );
    }

    // Parse + validate
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = AskSynthexSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { question } = parsed.data;
    const organizationId = auth.clientId;

    // Classify question complexity
    const tier = classifyQuestion(question);
    const modelTier = tierToModelTier(tier);

    // Retrieve structured context. A failed read is not "no data": answering
    // from an empty context would misreport the client's history.
    let retrieved: Awaited<ReturnType<typeof retrieveClientContext>>;
    try {
      retrieved = await retrieveClientContext(organizationId);
    } catch (err) {
      console.error('[ask-synthex] context read failed:', String(err));
      return NextResponse.json(
        {
          error:
            "I couldn't read your marketing data right now — please try again shortly.",
          answered: false,
        },
        { status: 500 }
      );
    }
    const { context, sources, postCount } = retrieved;

    // Below-threshold: answer from algorithm KB only
    const effectiveContext =
      postCount < 15
        ? `[Limited data — ${postCount} posts. Answering from general algorithm knowledge.]\n${context}`
        : context;

    let answer: string;

    try {
      answer = await callAI(question, effectiveContext, tier, postCount);
    } catch (err) {
      console.error('[ask-synthex] AI call failed:', String(err));
      return NextResponse.json(
        {
          error:
            "I wasn't able to answer that right now — please try rephrasing your question.",
          answered: false,
        },
        { status: 502 }
      );
    }

    const latencyMs = Date.now() - startMs;

    // Persisting the conversation is not provisioned (NOT_PROVISIONED.conversationLog).
    // Accuracy logging for predictive claims
    const hasPrediction = /likely|will|should|expect|predict|probably/i.test(
      answer
    );
    let scoreLedger: ScoreLedgerResult | undefined;
    if (hasPrediction) {
      scoreLedger = await recordScoreIssued({
        clientId: organizationId,
        domain: 'content',
        scoreValue: 80,
        confidence: postCount >= 15 ? 'high' : 'low',
        calibrationDataPoints: postCount,
        entityId: organizationId,
        sprintVersion: 'sprint-8',
      });
    }

    return NextResponse.json({
      answer,
      answered: true,
      model: modelTier,
      latencyMs,
      sources: sources.map(s => ({
        table: s.table,
        rows_queried: s.rowsQueried,
        confidence: s.confidence,
      })),
      postCount,
      belowThreshold: postCount < 15,
      notProvisioned: {
        ...NOT_PROVISIONED,
        ...(scoreLedger && !scoreLedger.recorded
          ? { scoreLedger: tableUnavailable(scoreLedger.table) }
          : {}),
      },
    });
  }
);

export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => _postHandler(request));
}
