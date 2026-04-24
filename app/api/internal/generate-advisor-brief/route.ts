/**
 * POST /api/internal/generate-advisor-brief
 *
 * CRON_SECRET-guarded internal route called by the `generate-advisor-brief`
 * Supabase Edge Function every Monday at 07:00 AEDT (Sunday 20:00 UTC).
 *
 * For each active organisation:
 *   1. Reads digest history (last 6 weeks), seasonal signals, authority score, GBP reviews
 *   2. Generates 3 ranked, data-specific actions via Claude
 *   3. Validates actions contain real numbers (rejects generic advice)
 *   4. Calculates dollar attribution from published posts + avg job value
 *   5. Adds competitor micro-insight if CompetitorKeywordGap data exists
 *   6. Adds GEO teaser if authority score is available
 *   7. Upserts to recommended_actions with status='generated' (7-day quality gate)
 *   8. Sends Slack alert for manual review
 *
 * Body (optional): { organizationId?: string }  — scope to single org for testing
 *
 * @task SYN-593 | Observability: SYN-627
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAlgorithmContextBlock } from '@/lib/algorithm/algorithm-context';
import { createEdgeFunctionRunner, ClientInput } from '@/lib/pipelines/runner';
import type { AiAdvisorMetadata } from '@/lib/pipelines/metadata-schemas';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { queryKnowledge, formatKnowledgeContext } from '@/lib/knowledge-query';

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      _supabaseAdmin = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
  }
  return _supabaseAdmin;
}

/** Average job value used for dollar attribution when no org-specific data exists. */
const DEFAULT_AVG_JOB_VALUE_AUD = 350;

/** Hours saved per published post (review + approval + scheduling). */
const HOURS_PER_POST = 0.37; // 22 minutes

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
  }
  return _anthropic;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdvisorAction {
  rank: number; // 1 = highest priority
  title: string;
  rationale: string; // ≤2 sentences, must cite a real number from the data
  effort: 'low' | 'medium' | 'high';
  expectedImpact: string; // quantified where possible
  actionUrl?: string; // deep-link into the Synthex dashboard
}

interface JourneyEngagementSummary {
  engagementRate: number; // 0.0–1.0
  pulseSurveyAvg: number | null;
  totalMomentsReceived: number;
  totalMomentsEngaged: number;
  mostEngagedType: string | null;
  leastEngagedType: string | null;
}

interface OrgContext {
  organizationId: string;
  orgName: string;
  industry: string | null;
  timezone: string;
  digestHistory: DigestSummary[];
  seasonalSignals: SeasonalOpportunity[];
  authorityScore: number | null;
  eeAtBreakdown: Record<string, number> | null;
  recentReviewRating: number | null;
  recentReviewCount: number;
  postsThisWeek: number;
  avgJobValueAud: number;
  competitorGap: string | null; // null if no data (SYN-583 not yet merged)
  contentScore: number | null; // null if content_score_history has no rows yet — SYN-666
  journeyEngagement: JourneyEngagementSummary | null; // null if no journey events yet — SYN-678
}

interface DigestSummary {
  weekStart: string;
  highlights: unknown;
  opportunities: unknown;
}

interface SeasonalOpportunity {
  opportunityLabel: string;
  signalType: string;
  windowStart: string;
  windowEnd: string;
  confidenceScore: number;
}

// ---------------------------------------------------------------------------
// Data gathering
// ---------------------------------------------------------------------------

async function gatherOrgContext(organizationId: string): Promise<OrgContext> {
  const [
    org,
    digests,
    signals,
    latestScore,
    recentReviews,
    weekPosts,
    competitorGap,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, industry: true, timezone: true },
    }),

    // Last 6 weekly digests — any user in the org (scoped via User.organizationId)
    prisma.aIWeeklyDigest.findMany({
      where: {
        user: { organizationId },
      },
      orderBy: { weekStart: 'desc' },
      take: 6,
      select: { weekStart: true, highlights: true, opportunities: true },
    }),

    // Seasonal signals active in the next 30 days matching the org's industry
    prisma.seasonalSignal.findMany({
      where: {
        industrySlug: { contains: 'au' }, // broadened fallback — industry matching below
        windowStart: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        // Exclude signals the org has dismissed
        dismissals: { none: { organizationId } },
      },
      orderBy: { confidenceScore: 'desc' },
      take: 3,
      select: {
        opportunityLabel: true,
        signalType: true,
        windowStart: true,
        windowEnd: true,
        confidenceScore: true,
      },
    }),

    // Latest authority score
    prisma.authorityScore.findFirst({
      where: { organizationId },
      orderBy: { computedAt: 'desc' },
      select: { score: true, eeAtBreakdown: true },
    }),

    // GBP reviews from the last 30 days
    prisma.gBPReview.findMany({
      where: {
        organizationId,
        reviewTime: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { rating: true },
    }),

    // Posts published this week
    prisma.publishQueueItem.count({
      where: {
        organizationId,
        status: 'published',
        publishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),

    // Competitor keyword gap — null-safe, joined to TrackedCompetitor for domain
    prisma.competitorKeywordGap
      .findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        select: {
          keyword: true,
          competitor: { select: { domain: true, name: true } },
        },
      })
      .catch(() => null),
  ]);

  if (!org) throw new Error(`Organisation ${organizationId} not found`);

  const avgRating =
    recentReviews.length > 0
      ? recentReviews.reduce((sum, r) => sum + r.rating, 0) /
        recentReviews.length
      : null;

  return {
    organizationId,
    orgName: org.name,
    industry: org.industry,
    timezone: org.timezone,
    digestHistory: digests.map(d => ({
      weekStart: d.weekStart.toISOString().split('T')[0],
      highlights: d.highlights,
      opportunities: d.opportunities,
    })),
    seasonalSignals: signals.map(s => ({
      opportunityLabel: s.opportunityLabel,
      signalType: s.signalType,
      windowStart: s.windowStart.toISOString().split('T')[0],
      windowEnd: s.windowEnd.toISOString().split('T')[0],
      confidenceScore: s.confidenceScore,
    })),
    authorityScore: latestScore?.score ?? null,
    eeAtBreakdown: latestScore
      ? (latestScore.eeAtBreakdown as Record<string, number>)
      : null,
    recentReviewRating: avgRating,
    recentReviewCount: recentReviews.length,
    postsThisWeek: weekPosts,
    avgJobValueAud: DEFAULT_AVG_JOB_VALUE_AUD,
    competitorGap: competitorGap
      ? `${competitorGap.keyword} (${competitorGap.competitor?.domain ?? competitorGap.competitor?.name ?? 'unknown competitor'})`
      : null,
    contentScore: await fetchContentScore(organizationId),
    journeyEngagement: await fetchJourneyEngagement(organizationId),
  };
}

/** Fetch journey engagement summary from journey_analytics view. Returns null on error or no data. — SYN-678 */
async function fetchJourneyEngagement(
  organizationId: string
): Promise<JourneyEngagementSummary | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('journey_analytics')
      .select(
        'engagement_rate, pulse_survey_avg, total_moments_received, total_moments_engaged, moments_detail'
      )
      .eq('client_id', organizationId)
      .maybeSingle();

    if (!data) return null;

    const row = data as {
      engagement_rate: number;
      pulse_survey_avg: number | null;
      total_moments_received: number;
      total_moments_engaged: number;
      moments_detail: Array<{ event_type: string; engagement_outcome: string }>;
    };

    // Derive most/least engaged moment type from moments_detail JSONB array
    const engagedByType: Record<string, number> = {};
    const totalByType: Record<string, number> = {};
    for (const m of row.moments_detail ?? []) {
      const t = m.event_type;
      totalByType[t] = (totalByType[t] ?? 0) + 1;
      if (
        m.engagement_outcome !== 'delivered' &&
        m.engagement_outcome !== 'ignored'
      ) {
        engagedByType[t] = (engagedByType[t] ?? 0) + 1;
      }
    }

    const rateByType = Object.keys(totalByType).map(t => ({
      type: t,
      rate: (engagedByType[t] ?? 0) / totalByType[t],
    }));

    const sorted = rateByType.sort((a, b) => b.rate - a.rate);
    const mostEngagedType = sorted[0]?.type ?? null;
    const leastEngagedType = sorted[sorted.length - 1]?.type ?? null;

    return {
      engagementRate: row.engagement_rate,
      pulseSurveyAvg: row.pulse_survey_avg,
      totalMomentsReceived: row.total_moments_received,
      totalMomentsEngaged: row.total_moments_engaged,
      mostEngagedType,
      leastEngagedType:
        leastEngagedType !== mostEngagedType ? leastEngagedType : null,
    };
  } catch {
    return null;
  }
}

/** Fetch latest Content Score from content_score_history. Returns null on error or no data. — SYN-666 */
async function fetchContentScore(
  organizationId: string
): Promise<number | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('content_score_history')
      .select('score')
      .eq('organization_id', organizationId)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? (data as { score: number }).score : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// AI inference
// ---------------------------------------------------------------------------

async function generateActions(
  ctx: OrgContext,
  knowledgeContext?: string
): Promise<AdvisorAction[]> {
  const hasDigestData = ctx.digestHistory.length > 0;
  const hasSeasonalData = ctx.seasonalSignals.length > 0;
  const hasAuthorityData = ctx.authorityScore !== null;
  const hasReviewData = ctx.recentReviewCount > 0;

  const dataSection = [
    hasDigestData
      ? `Weekly digest history (last ${ctx.digestHistory.length} weeks):\n${JSON.stringify(ctx.digestHistory, null, 2)}`
      : 'Weekly digest history: no data yet (new account)',

    hasSeasonalData
      ? `Upcoming seasonal opportunities:\n${JSON.stringify(ctx.seasonalSignals, null, 2)}`
      : 'Seasonal signals: none active in the next 30 days',

    hasAuthorityData
      ? `Authority score: ${ctx.authorityScore}/100\nBreakdown: ${JSON.stringify(ctx.eeAtBreakdown)}`
      : 'Authority score: not yet calculated',

    hasReviewData
      ? `Recent GBP reviews (last 30 days): ${ctx.recentReviewCount} reviews, average ${ctx.recentReviewRating?.toFixed(1)} stars`
      : 'GBP reviews: none in the last 30 days',

    `Posts published this week: ${ctx.postsThisWeek}`,
    `Industry: ${ctx.industry ?? 'not specified'}`,

    ctx.competitorGap ? `Competitor keyword gap: ${ctx.competitorGap}` : '',

    ctx.contentScore !== null
      ? `Content performance score: ${ctx.contentScore}/100 (weekly composite — higher = stronger content engagement relative to baseline)`
      : 'Content performance score: building data — fewer than 10 posts analysed',

    ctx.journeyEngagement
      ? [
          `Journey engagement (automated communications):`,
          `  Engagement rate: ${(ctx.journeyEngagement.engagementRate * 100).toFixed(1)}% (${ctx.journeyEngagement.totalMomentsEngaged} of ${ctx.journeyEngagement.totalMomentsReceived} moments acted on)`,
          ctx.journeyEngagement.pulseSurveyAvg !== null
            ? `  Pulse survey average: ${ctx.journeyEngagement.pulseSurveyAvg.toFixed(1)}/5`
            : null,
          ctx.journeyEngagement.mostEngagedType
            ? `  Most engaged moment type: ${ctx.journeyEngagement.mostEngagedType}`
            : null,
          ctx.journeyEngagement.leastEngagedType
            ? `  Least engaged moment type: ${ctx.journeyEngagement.leastEngagedType}`
            : null,
        ]
          .filter(Boolean)
          .join('\n')
      : 'Journey engagement: no automated communications sent yet',

    knowledgeContext ?? '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const algorithmContext = getAlgorithmContextBlock();

  const prompt = `You are a senior marketing strategist advising a small Australian business called "${ctx.orgName}".

Generate exactly 3 prioritised marketing actions for them to take this week. Each action MUST:
1. Reference at least one real number from their data (a score, count, rating, date, percentage)
2. Be specific to their situation — no generic advice like "post more content" or "engage with your audience"
3. Be achievable by a non-marketing owner in under 2 hours

ALGORITHM SIGNAL RULE: When your recommendations involve platform content or website improvements,
ground them in the verified algorithm signals provided below. Use the plain-English descriptions
provided — NEVER expose raw signal names (NavBoost, sends_per_reach, CrUX, etc.) in the output.

JOURNEY ENGAGEMENT RULE: When journey_engagement data is present (engagement rate, pulse survey avg,
most/least engaged moment type), add a "What's working for you" note of 1-2 plain-English sentences
to the rationale of the most relevant action. Reference the specific moment type or engagement figure.
Example: "Your 30-day check-in emails are your most-engaged touch — clients are reading and responding."
Do NOT add this note if journey engagement data is absent.

Return a JSON array of exactly 3 objects with this structure:
{
  "rank": 1|2|3,
  "title": "short action title (max 8 words)",
  "rationale": "1-2 sentences citing specific data from their account",
  "effort": "low"|"medium"|"high",
  "expectedImpact": "quantified outcome where possible"
}

--- BUSINESS DATA ---
${dataSection}
--- END DATA ---

${algorithmContext}

Return ONLY the JSON array. No preamble, no explanation.`;

  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text')
    throw new Error('Unexpected Claude response type');

  // Strip markdown code fences if present
  const raw = content.text
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();
  const parsed = JSON.parse(raw) as AdvisorAction[];

  if (!Array.isArray(parsed) || parsed.length !== 3) {
    throw new Error(
      `Expected 3 actions, got ${Array.isArray(parsed) ? parsed.length : 'non-array'}`
    );
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Validation — reject generic (non-data-specific) actions
// ---------------------------------------------------------------------------

const GENERIC_PHRASES = [
  'post more content',
  'engage with your audience',
  'be consistent',
  'increase your presence',
  'create more content',
  'improve your social media',
];

function validateActions(actions: AdvisorAction[]): void {
  for (const action of actions) {
    const text = (action.rationale + ' ' + action.title).toLowerCase();
    const isGeneric = GENERIC_PHRASES.some(phrase => text.includes(phrase));
    if (isGeneric) {
      throw new Error(
        `Generic action detected: "${action.title}" — must cite real data`
      );
    }
    // Must contain at least one number or percentage
    const hasNumber = /\d/.test(action.rationale);
    if (!hasNumber) {
      throw new Error(
        `Action "${action.title}" rationale has no data reference (no numbers found)`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Dollar attribution
// ---------------------------------------------------------------------------

function buildDollarAttribution(ctx: OrgContext, jobCount: number): string {
  const revenue = jobCount * ctx.avgJobValueAud;
  const hours = Math.round(ctx.postsThisWeek * HOURS_PER_POST);
  return `${jobCount} additional enquiry${jobCount !== 1 ? 's' : ''} estimated at $${revenue.toLocaleString('en-AU')} revenue potential (${ctx.avgJobValueAud} avg job value). ${hours}h saved this week from automated publishing.`;
}

// ---------------------------------------------------------------------------
// GEO teaser
// ---------------------------------------------------------------------------

function buildGeoTeaser(ctx: OrgContext): string | null {
  if (ctx.authorityScore === null) return null;
  if (ctx.authorityScore >= 70) {
    return `Your authority score of ${ctx.authorityScore}/100 puts you in the top tier for AI-search citations. Maintain weekly content to hold this position.`;
  }
  const weakest = ctx.eeAtBreakdown
    ? Object.entries(ctx.eeAtBreakdown).sort(([, a], [, b]) => a - b)[0]
    : null;
  const pillar = weakest
    ? weakest[0].replace(/([A-Z])/g, ' $1').toLowerCase()
    : 'content freshness';
  return `Your authority score is ${ctx.authorityScore}/100. Improving ${pillar} could increase your chance of appearing in ChatGPT and Google AI Overviews for local searches.`;
}

// ---------------------------------------------------------------------------
// Slack quality-gate notification
// ---------------------------------------------------------------------------

async function notifySlack(
  orgName: string,
  organizationId: string,
  weekStart: string
): Promise<void> {
  const webhookUrl = process.env.ALERT_SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social'}/dashboard/advisor`;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `*Advisor Brief Ready for Review* — ${orgName}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Advisor Brief Ready* — ${orgName}\nWeek of ${weekStart}\n<${dashboardUrl}?org=${organizationId}|Review brief →>`,
          },
        },
      ],
    }),
  }).catch(() => {}); // Fire-and-forget
}

// ---------------------------------------------------------------------------
// Per-org processor (throws on failure — runner handles retry + error collection)
// ---------------------------------------------------------------------------

interface AdvisorBriefResult {
  generated: boolean;
  /** Data confidence score (0.0–1.0): fraction of data sources that had content */
  dataConfidence: number;
  actionsCount: number;
}

async function processOrg(
  organizationId: string,
  weekStart: Date
): Promise<AdvisorBriefResult> {
  const weekStartStr = weekStart.toISOString().split('T')[0];

  // Skip if already generated this week — not an error, report as skipped
  const existing = await prisma.recommendedAction.findUnique({
    where: { recommended_action_org_week: { organizationId, weekStart } },
    select: { id: true },
  });
  if (existing) return { generated: false, dataConfidence: 1, actionsCount: 0 };

  const ctx = await gatherOrgContext(organizationId);

  // Data confidence: fraction of 5 data sources that had content (0.0–1.0)
  const dataConfidence =
    (ctx.digestHistory.length > 0 ? 0.25 : 0) +
    (ctx.seasonalSignals.length > 0 ? 0.2 : 0) +
    (ctx.authorityScore !== null ? 0.2 : 0) +
    (ctx.recentReviewCount > 0 ? 0.2 : 0) +
    (ctx.postsThisWeek > 0 ? 0.15 : 0);

  const jobCount = Math.max(1, Math.round(ctx.postsThisWeek / 8));

  // ── Knowledge Graph enrichment (A/B path) ─────────────────────────────────
  // Enabled when KNOWLEDGE_GRAPH_ADVISOR=true. Falls back to standard context
  // if the KG has fewer than 10 entities (queryKnowledge returns [] in that case).
  let knowledgeContext: string | undefined;
  if (process.env.KNOWLEDGE_GRAPH_ADVISOR === 'true') {
    try {
      const kgQuery = [
        ctx.industry ? `${ctx.industry} marketing` : 'small business marketing',
        ctx.seasonalSignals[0]?.opportunityLabel ?? '',
        ctx.competitorGap ?? '',
      ]
        .filter(Boolean)
        .join(', ');

      const kgResults = await queryKnowledge(organizationId, kgQuery, {
        maxResults: 8,
        minRelevance: 0.35,
      });

      if (kgResults.length > 0) {
        knowledgeContext = formatKnowledgeContext(kgResults);
        logger.info('generate-advisor-brief: KG enrichment applied', {
          organizationId,
          kgResultsCount: kgResults.length,
        });
      }
    } catch (err) {
      // KG enrichment is non-fatal — degrade gracefully to standard context
      logger.warn(
        'generate-advisor-brief: KG enrichment failed, using standard context',
        {
          organizationId,
          error: err instanceof Error ? err.message : String(err),
        }
      );
    }
  }

  const actions = await generateActions(ctx, knowledgeContext);
  validateActions(actions); // throws if generic

  const dollarAttribution = buildDollarAttribution(ctx, jobCount);
  const geoTeaserText = buildGeoTeaser(ctx);
  const competitorMicroInsight = ctx.competitorGap
    ? `Competitor gap detected: "${ctx.competitorGap}" — consider targeting this keyword in upcoming posts.`
    : null;

  const resultsSummary = {
    digestWeeksAvailable: ctx.digestHistory.length,
    seasonalSignalsActive: ctx.seasonalSignals.length,
    authorityScore: ctx.authorityScore,
    recentReviews: ctx.recentReviewCount,
    postsThisWeek: ctx.postsThisWeek,
    generatedAt: new Date().toISOString(),
  };

  await prisma.recommendedAction.create({
    data: {
      organizationId,
      weekStart,
      actions: actions as unknown as Prisma.InputJsonValue,
      dollarAttribution,
      jobCountAttribution: jobCount,
      competitorMicroInsight,
      geoTeaserText,
      resultsSummary: resultsSummary as unknown as Prisma.InputJsonValue,
      status: 'generated',
    },
  });

  await notifySlack(ctx.orgName, organizationId, weekStartStr);

  logger.info('generate-advisor-brief: generated brief', {
    organizationId,
    weekStart: weekStartStr,
    actionsCount: actions.length,
    dataConfidence,
  });

  return { generated: true, dataConfidence, actionsCount: actions.length };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const advisorRunner = createEdgeFunctionRunner<
  { weekStart: Date },
  AdvisorBriefResult
>(
  'ai-advisor',
  async (
    input: { weekStart: Date },
    clientId: string
  ): Promise<AdvisorBriefResult> => {
    return processOrg(clientId, input.weekStart);
  },
  (
    output: AdvisorBriefResult
  ): { valid: boolean; metadata: Record<string, unknown> } => {
    // Valid if brief was generated with at least 3 actions and reasonable data confidence
    // Skipped orgs (generated: false, no error) are still valid — they ran correctly
    const valid =
      !output.generated ||
      (output.actionsCount >= 3 && output.dataConfidence >= 0.5);
    const metadata: AiAdvisorMetadata = {
      recommendation_count: output.actionsCount,
      avg_confidence: output.dataConfidence,
      algorithm_freshness_days: 0, // Populated when algorithm-freshness-monitor wires in
    };
    return { valid, metadata };
  }
);

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'GENERATE_ADVISOR_BRIEF');
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    organizationId?: string;
  };

  // Week start = most recent Monday (00:00 UTC)
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon
  const weekStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - (dayOfWeek === 1 ? 0 : dayOfWeek - 1)
    )
  );

  const whereClause = body.organizationId
    ? { id: body.organizationId }
    : { billingStatus: 'active' };

  const orgs = await prisma.organization.findMany({
    where: whereClause,
    select: { id: true },
  });

  const inputs: ClientInput<{ weekStart: Date }>[] = orgs.map(o => ({
    clientId: o.id,
    input: { weekStart },
  }));

  const runResult = await advisorRunner.run(inputs);

  const generated = runResult.outputs.filter(o => o.output?.generated).length;
  const skipped = runResult.outputs.filter(
    o => o.output && !o.output.generated
  ).length;

  logger.info('generate-advisor-brief: run complete', {
    runId: runResult.runId,
    status: runResult.status,
    weekStart: weekStart.toISOString().split('T')[0],
    generated,
    skipped,
    errors: runResult.clientsFailed,
    durationMs: runResult.durationMs,
  });

  return NextResponse.json({
    success: true,
    runId: runResult.runId,
    status: runResult.status,
    weekStart: weekStart.toISOString().split('T')[0],
    generated,
    skipped,
    errors: runResult.clientsFailed,
    durationMs: runResult.durationMs,
  });
}
