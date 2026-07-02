/**
 * Auto-research → governed-opportunity bridge (SYN-1033).
 *
 * Converts stored `TrendInsight` records into the existing governed-signal
 * pipeline (rank → convert → persist) so high-value research becomes reviewable
 * `MarketingAgencyOpportunity` records, a handoff packet for downstream work,
 * and an Obsidian writeback receipt — with explicit failure modes when the loop
 * cannot produce work.
 *
 * The build step is a PURE function of its inputs (no DB, no env, no clock other
 * than an injected `now`). The runner is a thin orchestration layer with all
 * side-effects injected, so both are fully unit-testable.
 *
 * @module lib/auto-research/research-bridge
 */

import {
  convertSignalsToOpportunities,
  rankGovernedSignals,
  type GovernedOpportunity,
  type GovernedSignal,
  type RankedSignal,
} from '@/lib/marketing-agency/intelligence/signal-ledger';
import {
  persistGovernedSignalRun,
  type PersistGovernedSignalRunResult,
} from '@/lib/marketing-agency/intelligence/signal-persistence';
import type { GateStatus } from '@/lib/marketing-agency/types';
import {
  appendNoteWithReceipt,
  isEnabled as obsidianEnabled,
  type ObsidianWriteReceipt,
} from '@/lib/obsidian/client';

/** Minimal shape the bridge needs from a `TrendInsight` record. */
export interface BridgeTrendInsight {
  id: string;
  platform: string;
  category: string;
  insight: string;
  confidence: number;
  dataPoints: number;
  runId: string;
  createdAt?: Date;
}

/** Explicit, enumerated reasons a run produced no (or partial) governed work. */
export type ResearchBridgeFailureMode =
  | 'no_findings'
  | 'low_confidence'
  | 'obsidian_unavailable'
  | 'linear_unavailable'
  | 'credentials_missing';

/** Linear/queue handoff metadata for a single governed opportunity. */
export interface ResearchOpportunityHandoff {
  opportunityExternalId: string;
  signalExternalId: string;
  title: string;
  recommendedAction: string;
  /** Agent/team that should own the follow-up work. */
  ownerRoute: string;
  score: number;
  confidence: number;
  approvalStatus: GateStatus;
  evidenceRefs: string[];
  sourceRunId: string;
  /** Whether live Linear issue creation is configured (slice-1 reports, does not create). */
  linearEnabled: boolean;
}

export interface BuildResearchBridgeContext {
  runId: string;
  organizationId: string;
  /** Human label for the org/business used on the governed signal. */
  orgLabel?: string;
  /** Minimum insight confidence to convert into a signal (default 0.55). */
  confidenceThreshold?: number;
  linearEnabled?: boolean;
  now?: Date;
}

export interface ResearchBridgeBuild {
  governedSignals: GovernedSignal[];
  rankedSignals: RankedSignal[];
  opportunities: GovernedOpportunity[];
  handoffs: ResearchOpportunityHandoff[];
  failureModes: ResearchBridgeFailureMode[];
  /** Markdown receipt body for the Obsidian 2nd-brain note. */
  obsidianNote: string;
  /** Deduped insight count considered. */
  discovered: number;
  /** Insights dropped for being below the confidence threshold. */
  belowThreshold: number;
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0.55;
const DEFAULT_RISK = 0.2;
const CREATIVE_CATEGORIES = new Set(['visual_style', 'format', 'hook']);

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Owner/agent route for the follow-up work, derived from the insight category. */
function ownerRouteForCategory(category: string): string {
  switch (category) {
    case 'hook':
    case 'cta':
    case 'topic':
      return 'marketing-strategy';
    case 'visual_style':
    case 'format':
      return 'creative-director';
    case 'hashtag':
      return 'social-content';
    default:
      return 'marketing-agency';
  }
}

/**
 * Collapse duplicate insights by platform+category+normalised text, keeping the
 * variant with the highest confidence (ties broken by data-point count).
 */
export function dedupeTrendInsights(
  insights: BridgeTrendInsight[]
): BridgeTrendInsight[] {
  const best = new Map<string, BridgeTrendInsight>();
  for (const insight of insights) {
    const key = `${insight.platform}::${insight.category}::${insight.insight
      .trim()
      .toLowerCase()}`;
    const existing = best.get(key);
    if (
      !existing ||
      insight.confidence > existing.confidence ||
      (insight.confidence === existing.confidence &&
        insight.dataPoints > existing.dataPoints)
    ) {
      best.set(key, insight);
    }
  }
  return [...best.values()];
}

/** Map a single trend insight into a governed signal the ledger can score. */
export function trendInsightToGovernedSignal(
  insight: BridgeTrendInsight,
  ctx: BuildResearchBridgeContext
): GovernedSignal {
  const label = ctx.orgLabel ?? 'Synthex portfolio';
  const capturedAt = (insight.createdAt ?? ctx.now ?? new Date(0)).toISOString();
  const confidence = clamp01(insight.confidence);

  return {
    id: `trend-${insight.id}`,
    source: {
      id: `auto-research-run-${insight.runId}`,
      kind: 'apify',
      label: `Auto-research · ${insight.platform}`,
      sourcePath: `auto-research/runs/${insight.runId}`,
      capturedAt,
      permissionContext: 'public',
    },
    capturedAt,
    business: label,
    client: label,
    product: insight.category,
    audienceSegment: `${insight.platform} audience`,
    narrative: insight.insight,
    content: insight.insight,
    freshness: 0.8,
    confidence,
    commercialImpact: confidence,
    creativePotential: CREATIVE_CATEGORIES.has(insight.category) ? 0.6 : 0.4,
    risk: DEFAULT_RISK,
    status: 'captured',
    evidenceRefs: [
      `auto-research:run:${insight.runId}`,
      `trend-insight:${insight.id}`,
      `platform:${insight.platform}`,
    ],
  };
}

function buildObsidianNote(
  ctx: BuildResearchBridgeContext,
  opportunities: GovernedOpportunity[],
  discovered: number,
  belowThreshold: number,
  now: Date
): string {
  const date = now.toISOString().slice(0, 10);
  const lines = [
    `\n## ${date} — Auto-research bridge (run ${ctx.runId})`,
    `- Discovered: ${discovered} insight(s); below threshold: ${belowThreshold}`,
    `- Reviewable opportunities: ${opportunities.length}`,
    ...opportunities.map(
      o =>
        `  - [${o.approvalGate.status}] ${o.title} _(score ${o.score}, confidence ${(o.confidence * 100).toFixed(0)}%)_`
    ),
  ];
  return lines.join('\n');
}

/**
 * Build the governed bridge output from trend insights. Pure: deterministic for
 * a given input + `ctx.now`.
 */
export function buildResearchBridge(
  insights: BridgeTrendInsight[],
  ctx: BuildResearchBridgeContext
): ResearchBridgeBuild {
  const now = ctx.now ?? new Date(0);
  const threshold = ctx.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const linearEnabled = ctx.linearEnabled ?? false;

  const deduped = dedupeTrendInsights(insights);
  const discovered = deduped.length;

  const qualifying = deduped.filter(i => clamp01(i.confidence) >= threshold);
  const belowThreshold = discovered - qualifying.length;

  const governedSignals = qualifying.map(i =>
    trendInsightToGovernedSignal(i, ctx)
  );
  const rankedSignals = rankGovernedSignals(governedSignals);
  const opportunities = convertSignalsToOpportunities(governedSignals);

  const categoryById = new Map(
    qualifying.map(i => [`trend-${i.id}`, i.category])
  );
  const handoffs: ResearchOpportunityHandoff[] = opportunities.map(o => ({
    opportunityExternalId: o.id,
    signalExternalId: o.signalId,
    title: o.title,
    recommendedAction: o.nextAction,
    ownerRoute: ownerRouteForCategory(categoryById.get(o.signalId) ?? ''),
    score: o.score,
    confidence: o.confidence,
    approvalStatus: o.approvalGate.status,
    evidenceRefs: o.evidenceRefs,
    sourceRunId: ctx.runId,
    linearEnabled,
  }));

  const failureModes: ResearchBridgeFailureMode[] = [];
  if (discovered === 0) failureModes.push('no_findings');
  if (discovered > 0 && opportunities.length === 0) {
    failureModes.push('low_confidence');
  }

  return {
    governedSignals,
    rankedSignals,
    opportunities,
    handoffs,
    failureModes,
    obsidianNote: buildObsidianNote(
      ctx,
      opportunities,
      discovered,
      belowThreshold,
      now
    ),
    discovered,
    belowThreshold,
  };
}

// ---------------------------------------------------------------------------
// Runner — thin orchestration with injectable side-effects.
// ---------------------------------------------------------------------------

export interface RunResearchBridgeInput {
  runId: string;
  organizationId: string;
  orgLabel?: string;
  insights: BridgeTrendInsight[];
  confidenceThreshold?: number;
  obsidianEnabled?: boolean;
  linearEnabled?: boolean;
  now?: Date;
}

export interface ResearchBridgeReceipt {
  discovered: number;
  belowThreshold: number;
  signalsPersisted: number;
  opportunitiesCreated: number;
  waitingForApproval: number;
  obsidian: ObsidianWriteReceipt;
  handoffs: ResearchOpportunityHandoff[];
  failureModes: ResearchBridgeFailureMode[];
}

export interface ResearchBridgeDeps {
  persist?: typeof persistGovernedSignalRun;
  appendObsidian?: (
    path: string,
    content: string
  ) => Promise<ObsidianWriteReceipt>;
}

/**
 * Run the bridge end-to-end: build governed work, persist it, write the Obsidian
 * receipt, and return an operator-facing summary of what was discovered,
 * created, is waiting for approval, and what failed.
 */
export async function runResearchBridge(
  input: RunResearchBridgeInput,
  deps: ResearchBridgeDeps = {}
): Promise<ResearchBridgeReceipt> {
  const persist = deps.persist ?? persistGovernedSignalRun;
  const appendObsidian = deps.appendObsidian ?? appendNoteWithReceipt;
  const isObsidianOn = input.obsidianEnabled ?? obsidianEnabled();

  const build = buildResearchBridge(input.insights, {
    runId: input.runId,
    organizationId: input.organizationId,
    orgLabel: input.orgLabel,
    confidenceThreshold: input.confidenceThreshold,
    linearEnabled: input.linearEnabled,
    now: input.now,
  });

  const failureModes = [...build.failureModes];

  // Obsidian writeback receipt — explicit failure mode when the vault is on but
  // the write did not land.
  let obsidian: ObsidianWriteReceipt = {
    enabled: false,
    ok: false,
    error: 'Obsidian writeback is disabled.',
  };
  if (isObsidianOn && build.opportunities.length > 0) {
    obsidian = await appendObsidian(
      `Clients/${input.organizationId}/insights.md`,
      build.obsidianNote
    );
    if (!obsidian.ok) failureModes.push('obsidian_unavailable');
  }

  let persistResult: PersistGovernedSignalRunResult = {
    signalsPersisted: 0,
    opportunitiesPersisted: 0,
  };
  if (build.opportunities.length > 0) {
    persistResult = await persist({
      organizationId: input.organizationId,
      rankedSignals: build.rankedSignals,
      opportunities: build.opportunities,
      metadata: {
        source: 'auto-research',
        sourceRunId: input.runId,
        obsidianWriteback: { enabled: obsidian.enabled, ok: obsidian.ok },
        ownerRoutes: Object.fromEntries(
          build.handoffs.map(h => [h.opportunityExternalId, h.ownerRoute])
        ),
      },
    });
  }

  return {
    discovered: build.discovered,
    belowThreshold: build.belowThreshold,
    signalsPersisted: persistResult.signalsPersisted,
    opportunitiesCreated: persistResult.opportunitiesPersisted,
    waitingForApproval: build.opportunities.length,
    obsidian,
    handoffs: build.handoffs,
    failureModes,
  };
}
