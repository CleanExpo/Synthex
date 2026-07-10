/**
 * performance_* namespace — READ-ONLY tools over outcome/score/cost data:
 *   - performance_get_outcomes: MarketingAgencyOutcomeEvent (org-indexed).
 *   - performance_get_scores:   the HEURISTIC content scorer — rule-based
 *     (Flesch-Kincaid-style readability, pattern-matched engagement etc.),
 *     NOT a model evaluation. The output says so explicitly (method:
 *     'heuristic') so downstream agents never mistake it for ground truth.
 *   - performance_cost_report:  pipeline_cost_ledger via the Prisma model
 *     PipelineCostLedger (schema.prisma — clientId = organizationId; rows
 *     with clientId null are board-level pipelines and are NEVER exposed
 *     here). Org filter is explicit in the query and machine-enforced by
 *     tests/unit/mcp/namespace-tools.test.ts.
 */
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { contentScorer } from '@/lib/ai/content-scorer';
import type { StudioTool } from './types';

const GetOutcomesArgs = z.object({
  eventType: z.string().optional(),
  campaignId: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const GetScoresArgs = z.object({
  content: z.string().min(1).max(20000),
  platform: z.string().min(1).max(50).optional(),
});

const CostReportArgs = z.object({
  sinceDays: z.number().int().min(1).max(365).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

const GetOutcomesOutput = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      campaignId: z.string().nullable(),
      signalId: z.string(),
      opportunityId: z.string().nullable(),
      eventType: z.string(),
      status: z.string(),
      outcomeMetric: z.string().nullable(),
      observedValue: z.string().nullable(),
      confidence: z.number().nullable(),
      notes: z.string().nullable(),
      recordedAt: z.string(),
    })
  ),
  total: z.number(),
});

const DimensionScoreShape = z.object({
  score: z.number(),
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
});

const GetScoresOutput = z.object({
  method: z.literal('heuristic'),
  scorer: z.literal('content-scorer-heuristic-v1'),
  platform: z.string(),
  overall: z.number(),
  dimensions: z.object({
    readability: DimensionScoreShape,
    engagement: DimensionScoreShape,
    platformFit: DimensionScoreShape,
    clarity: DimensionScoreShape,
    emotional: DimensionScoreShape,
    writingQuality: DimensionScoreShape,
  }),
  topSuggestions: z.array(z.string()),
});

const CostReportOutput = z.object({
  sinceDays: z.number(),
  totalRuns: z.number(),
  totalCostUsd: z.number(),
  byPipeline: z.array(
    z.object({
      pipelineName: z.string(),
      runs: z.number(),
      costUsd: z.number(),
    })
  ),
  entries: z.array(
    z.object({
      pipelineName: z.string(),
      runId: z.string(),
      model: z.string(),
      inputTokens: z.number(),
      outputTokens: z.number(),
      costUsd: z.number(),
      createdAt: z.string(),
    })
  ),
});

const round6 = (n: number) => parseFloat(n.toFixed(6));

export const PERFORMANCE_TOOLS: StudioTool[] = [
  {
    name: 'performance_get_outcomes',
    description:
      'List recorded marketing outcome events for the caller org (newest first), optionally filtered by eventType/campaignId. Observational data — status/confidence reflect what was observed, not verified attribution.',
    scope: 'performance',
    riskClass: 'read',
    costClass: 'free',
    schema: GetOutcomesArgs,
    outputSchema: GetOutcomesOutput,
    execute: async (args, ctx) => {
      const a = GetOutcomesArgs.parse(args);
      const rows = await prisma.marketingAgencyOutcomeEvent.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(a.eventType ? { eventType: a.eventType } : {}),
          ...(a.campaignId ? { campaignId: a.campaignId } : {}),
        },
        orderBy: { recordedAt: 'desc' },
        take: a.limit ?? 20,
        select: {
          id: true,
          campaignId: true,
          signalId: true,
          opportunityId: true,
          eventType: true,
          status: true,
          outcomeMetric: true,
          observedValue: true,
          confidence: true,
          notes: true,
          recordedAt: true,
        },
      });
      return {
        events: rows.map(r => ({
          ...r,
          recordedAt: r.recordedAt.toISOString(),
        })),
        total: rows.length,
      };
    },
  },
  {
    name: 'performance_get_scores',
    description:
      'Score a piece of content with the HEURISTIC content scorer (rule-based readability/engagement/platform-fit/clarity/emotional/writing-quality — pattern matching, NOT a model or human evaluation; treat as a linting signal). Pure function over your input; touches no org data.',
    scope: 'performance',
    riskClass: 'read',
    costClass: 'free',
    schema: GetScoresArgs,
    outputSchema: GetScoresOutput,
    execute: async (args, _ctx) => {
      const a = GetScoresArgs.parse(args);
      const platform = (a.platform ?? 'linkedin').toLowerCase();
      const result = contentScorer.score(a.content, platform);
      return {
        method: 'heuristic' as const,
        scorer: 'content-scorer-heuristic-v1' as const,
        platform,
        overall: result.overall,
        dimensions: result.dimensions,
        topSuggestions: result.topSuggestions,
      };
    },
  },
  {
    name: 'performance_cost_report',
    description:
      'AI pipeline cost report for the caller org from the pipeline cost ledger: totals + per-pipeline rollup + recent entries. Covers pipelines attributed to your org only (board-level unattributed runs are excluded). Default window 30 days.',
    scope: 'performance',
    riskClass: 'read',
    costClass: 'free',
    schema: CostReportArgs,
    outputSchema: CostReportOutput,
    execute: async (args, ctx) => {
      const a = CostReportArgs.parse(args);
      const sinceDays = a.sinceDays ?? 30;
      const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
      // ORG ISOLATION: clientId in pipeline_cost_ledger is the org/client id.
      // The explicit equality filter both scopes to the caller org AND
      // excludes clientId-null board-level rows (Prisma equality never
      // matches NULL). Do not weaken this filter.
      const rows = await prisma.pipelineCostLedger.findMany({
        where: {
          clientId: ctx.organizationId,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        take: a.limit ?? 100,
        select: {
          pipelineName: true,
          runId: true,
          model: true,
          inputTokens: true,
          outputTokens: true,
          costUsd: true,
          createdAt: true,
        },
      });
      const byPipeline = new Map<string, { runs: number; costUsd: number }>();
      for (const r of rows) {
        const agg = byPipeline.get(r.pipelineName) ?? { runs: 0, costUsd: 0 };
        agg.runs += 1;
        agg.costUsd += r.costUsd;
        byPipeline.set(r.pipelineName, agg);
      }
      return {
        sinceDays,
        totalRuns: rows.length,
        totalCostUsd: round6(rows.reduce((s, r) => s + r.costUsd, 0)),
        byPipeline: [...byPipeline.entries()]
          .map(([pipelineName, agg]) => ({
            pipelineName,
            runs: agg.runs,
            costUsd: round6(agg.costUsd),
          }))
          .sort((x, y) => y.costUsd - x.costUsd),
        entries: rows.map(r => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    },
  },
];
