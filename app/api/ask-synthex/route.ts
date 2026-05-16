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
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import { withRateLimit } from '@/lib/rate-limit/rate-limiter';
import { routedCall } from '@/lib/ai/model-router';
import { recordScoreIssued } from '@/lib/intelligence/accuracy-ledger';
import type { AuthContext } from '@/lib/auth/with-auth';

// ── Feature flag ──────────────────────────────────────────────────────────────

function isFeatureEnabled(isAdmin: boolean): boolean {
  const flag = process.env.ENABLE_ASK_SYNTHEX_CLIENT_ROLLOUT;
  if (flag === 'true') return true;
  return isAdmin; // always available to admins during review period
}

// ── Supabase admin (for writing conversations) ────────────────────────────────

// SYN-789: minimal schema for the three tables this route touches. Keeps the
// supabase client strongly typed without requiring the full generated Database
// type. Three previous `(supabase as any)` casts at the call sites masked the
// missing schema — real typos in table/column names would have shipped silently.
type JourneyAnalyticsRow = {
  organization_id: string;
  engagement_rate: number;
  total_moments_sent: number;
  avg_pulse_score: number;
};

type ClientConversationInsert = {
  client_id: string;
  question: string;
  response: Record<string, unknown>;
};

type ConversationEventInsert = {
  client_id: string;
  question: string;
  question_category: string;
  answered: boolean;
  failure_reason: string | null;
  model_tier_used: string | null;
};

type AskSynthexDatabase = {
  public: {
    Tables: {
      journey_analytics: {
        Row: JourneyAnalyticsRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      client_conversations: {
        Row: ClientConversationInsert & { id: string; created_at: string };
        Insert: ClientConversationInsert;
        Update: Partial<ClientConversationInsert>;
        Relationships: [];
      };
      conversation_events: {
        Row: ConversationEventInsert & { id: string; created_at: string };
        Insert: ConversationEventInsert;
        Update: Partial<ConversationEventInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let _supabaseAdmin: ReturnType<typeof createClient<AskSynthexDatabase>> | null =
  null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      _supabaseAdmin = createClient<AskSynthexDatabase>(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
  }
  return _supabaseAdmin;
}

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
  const recentPosts = await prisma.platformPost
    .findMany({
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
    })
    .catch(() => []);

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
  const healthScore = await prisma.clientHealthScore
    .findFirst({
      where: { organizationId },
      orderBy: { weekStart: 'desc' },
      select: { overallScore: true, dimensions: true, weekStart: true },
    })
    .catch(() => null);

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
  const advisorBriefs = await prisma.recommendedAction
    .findMany({
      where: { organizationId, weekStart: { gte: actionCutoff } },
      orderBy: { weekStart: 'desc' },
      take: 3,
      select: { actions: true, weekStart: true },
    })
    .catch(() => []);

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

  // 5. Journey engagement (if journey analytics available)
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data: journeyData, error: journeyErr } = await supabase
      .from('journey_analytics')
      .select('engagement_rate, total_moments_sent, avg_pulse_score')
      .eq('organization_id', organizationId)
      .single();

    if (!journeyErr && journeyData) {
      const jd = journeyData as {
        engagement_rate: number;
        total_moments_sent: number;
      };
      const engRate = (jd.engagement_rate * 100).toFixed(1);
      contextParts.push(
        `Journey engagement rate: ${engRate}%, ${jd.total_moments_sent} moments sent.`
      );
      sources.push({
        table: 'journey_analytics',
        rowsQueried: 1,
        confidence: 'Medium',
        summary: `${engRate}% engagement rate`,
      });
    }
  }

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

    // Retrieve structured context
    const { context, sources, postCount } =
      await retrieveClientContext(organizationId);

    const supabase = getSupabaseAdmin();

    // Below-threshold: answer from algorithm KB only
    const effectiveContext =
      postCount < 15
        ? `[Limited data — ${postCount} posts. Answering from general algorithm knowledge.]\n${context}`
        : context;

    let answer: string;
    let answered = true;
    let failureReason: string | null = null;

    try {
      answer = await callAI(question, effectiveContext, tier, postCount);
    } catch (err) {
      answered = false;
      failureReason = String(err);
      answer =
        "I wasn't able to answer that right now — please try rephrasing your question.";
    }

    const latencyMs = Date.now() - startMs;

    // Persist conversation (non-fatal)
    if (supabase) {
      const responsePayload = {
        answer,
        sources: sources.map(s => ({
          table: s.table,
          rows_queried: s.rowsQueried,
          confidence: s.confidence,
        })),
        model_tier: modelTier,
        score: {
          domain: 'conversation',
          value: answered ? 80 : 0,
          confidence:
            postCount >= 15 ? 'high' : postCount >= 5 ? 'medium' : 'low',
          signals: [],
          calibration: {
            dataPoints: postCount,
            meetsThreshold: postCount >= 15,
            thresholdRequired: 15,
            accuracyRate: null,
            firstScoredAt: null,
            calibrationSummary:
              postCount >= 15
                ? `Based on ${postCount} posts`
                : `Calibration in progress — ${postCount} posts collected`,
          },
          generatedAt: new Date().toISOString(),
        },
      };

      if (answered) {
        // Fire-and-forget inserts — non-fatal if they fail
        void (async () => {
          const { error } = await supabase.from('client_conversations').insert({
            client_id: organizationId,
            question,
            response: responsePayload,
          });
          if (error)
            console.error(
              '[ask-synthex] failed to persist conversation:',
              (error as { message: string }).message
            );
        })();

        // Accuracy logging for predictive claims
        const hasPrediction =
          /likely|will|should|expect|predict|probably/i.test(answer);
        if (hasPrediction) {
          recordScoreIssued({
            clientId: organizationId,
            domain: 'content',
            scoreValue: 80,
            confidence: postCount >= 15 ? 'high' : 'low',
            calibrationDataPoints: postCount,
            entityId: organizationId,
            sprintVersion: 'sprint-8',
          }).catch(() => undefined);
        }
      }

      // Always log to conversation_events (fire-and-forget)
      void (async () => {
        const { error } = await supabase.from('conversation_events').insert({
          client_id: organizationId,
          question,
          question_category: categoriseQuestion(question),
          answered,
          failure_reason: failureReason,
          model_tier_used: answered ? modelTier : null,
        });
        if (error)
          console.error(
            '[ask-synthex] failed to log conversation event:',
            (error as { message: string }).message
          );
      })();
    }

    return NextResponse.json({
      answer,
      model: modelTier,
      latencyMs,
      sources: sources.map(s => ({
        table: s.table,
        rows_queried: s.rowsQueried,
        confidence: s.confidence,
      })),
      postCount,
      belowThreshold: postCount < 15,
    });
  }
);

export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => _postHandler(request));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function categoriseQuestion(
  question: string
):
  | 'performance'
  | 'algorithm'
  | 'brand'
  | 'competitor'
  | 'general'
  | 'out_of_scope' {
  const lower = question.toLowerCase();
  if (
    /algorithm|platform|instagram|facebook|tiktok|linkedin|posting time/.test(
      lower
    )
  )
    return 'algorithm';
  if (/competitor|rival|other business/.test(lower)) return 'competitor';
  if (/brand|voice|tone|style/.test(lower)) return 'brand';
  if (
    /score|reach|impression|engagement|click|follower|analytics|post|content/.test(
      lower
    )
  )
    return 'performance';
  if (/synthex|subscription|invoice|billing|plan|feature/.test(lower))
    return 'out_of_scope';
  return 'general';
}
