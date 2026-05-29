/**
 * Agentic Marketing Intelligence 2026 — scoring models.
 *
 * Faithful implementation of the 12 formulas in
 * docs/marketing-intelligence/search-math-models.md.
 *
 * Integrity contract:
 *  - Pure functions, no I/O, no network, no fabricated data.
 *  - Every score returns a ScoreResult that records which inputs were real vs
 *    missing, and clamps confidenceFactor low when inputs are placeholders.
 *  - Scores are RELATIVE PRIORITIES, never predictions of traffic.
 */

import {
  CONFIDENCE_SCORE,
  DEFAULT_WEIGHTS,
  type ActionPriority,
  type ConfidenceLabel,
  type DataStatus,
  type EeatChecklist,
  type EntitySet,
  type EffortSize,
  type FunnelStage,
  type GeoInputs,
  type PageMetrics,
  type ScoreResult,
  type TopicCluster,
  type Weights,
} from './types';

const EPSILON = 0.1;

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
export const norm = (x: number, max: number): number => (max <= 0 ? 0 : clamp01(x / max));
export const invNorm = (x: number, max: number): number => clamp01(1 - norm(x, max));

/** SERP position → 0..1 (pos 1 => 1.0, pos 10 => 0.1, >10 => 0). */
export const posScore = (avgPosition: number): number => clamp01((11 - avgPosition) / 10);

/** Fractional decline of a metric over a window (0 if it grew). */
const drop = (prev?: number, curr?: number): number => {
  if (prev === undefined || curr === undefined) return 0;
  return clamp01((prev - curr) / Math.max(prev, EPSILON));
};

/** Positions lost since last window, capped at 10 (0 if improved). */
const worsening = (prevPos?: number, currPos?: number): number => {
  if (prevPos === undefined || currPos === undefined) return 0;
  return clamp01((currPos - prevPos) / 10);
};

const FUNNEL_WEIGHT: Record<FunnelStage, number> = {
  informational: 0.3,
  consideration: 0.6,
  transactional: 1.0,
  navigational: 0.5,
};

const EFFORT_WEIGHT: Record<EffortSize, number> = { XS: 0.1, S: 0.25, M: 0.5, L: 0.75, XL: 1.0 };

// ---------------------------------------------------------------------------
// Data-status helper — the heart of the no-fabrication guarantee
// ---------------------------------------------------------------------------

function resolveDataStatus(used: string[], missing: string[]): { status: DataStatus; confidence: number } {
  if (missing.length === 0) return { status: 'VERIFIED', confidence: 1 };
  if (used.length === 0) return { status: 'DATA_REQUIRED', confidence: 0.1 };
  // Partial: confidence scales with the share of real inputs, capped at 0.6.
  const ratio = used.length / (used.length + missing.length);
  return { status: 'PARTIAL', confidence: Math.min(0.6, clamp01(ratio)) };
}

// ---------------------------------------------------------------------------
// 1. Ranking Opportunity Score
// ---------------------------------------------------------------------------

export function rankingOpportunity(p: PageMetrics, demandMax: number): ScoreResult {
  const used: string[] = [];
  const missing: string[] = [];

  const demandRaw = p.impressions ?? p.searchVolume;
  if (demandRaw !== undefined) used.push('search_demand');
  else missing.push('search_demand (GSC impressions or Semrush volume)');
  const searchDemand = demandRaw !== undefined ? norm(demandRaw, demandMax) : 0;

  const intentMatch = pick(p.intentMatch, used, missing, 'intent_match');
  const authorityGap = pick(p.authorityGap, used, missing, 'authority_gap');

  const commercialValue = commercialValueScore(p).value;
  if (p.funnelStage) used.push('funnel_stage'); else missing.push('funnel_stage');

  const { status, confidence } = resolveDataStatus(used, missing);
  const effort = EFFORT_WEIGHT[(p as { effort?: EffortSize }).effort ?? 'M'];

  const value =
    (searchDemand * intentMatch * authorityGap * commercialValue * confidence) / Math.max(effort, EPSILON);

  return {
    name: 'ranking_opportunity',
    value,
    dataStatus: status,
    confidenceFactor: confidence,
    inputsUsed: used,
    inputsMissing: missing,
    note: 'Unbounded score; compare only within the same scored set. Multiplicative — any zero factor zeroes opportunity.',
  };
}

// ---------------------------------------------------------------------------
// 2. Content Decay Score
// ---------------------------------------------------------------------------

export function contentDecay(p: PageMetrics, w: Weights = DEFAULT_WEIGHTS): ScoreResult {
  const used: string[] = [];
  const missing: string[] = [];

  const dImp = trackDrop(p.prevImpressions, p.impressions, used, missing, 'impressions');
  const dClk = trackDrop(p.prevClicks, p.clicks, used, missing, 'clicks');
  const dCtr = trackDrop(p.prevCtr, p.ctr, used, missing, 'ctr');
  const dPos = trackWorsen(p.prevAvgPosition, p.avgPosition, used, missing, 'avg_position');

  let ageFactor = 0;
  if (p.monthsSinceUpdate !== undefined) {
    ageFactor = clamp01(p.monthsSinceUpdate / w.freshnessAgeHorizonMonths);
    used.push('months_since_update');
  } else missing.push('months_since_update');

  const compGain = pick(p.competitorGain, used, missing, 'competitor_gain');

  const value =
    w.decay.imp * dImp +
    w.decay.clk * dClk +
    w.decay.ctr * dCtr +
    w.decay.pos * dPos +
    w.decay.age * ageFactor +
    w.decay.comp * compGain;

  const { status, confidence } = resolveDataStatus(used, missing);
  return {
    name: 'content_decay',
    value: clamp01(value),
    dataStatus: status,
    confidenceFactor: confidence,
    inputsUsed: used,
    inputsMissing: missing,
    note: 'High score = refresh candidate. Requires GSC period-over-period data to be meaningful.',
  };
}

// ---------------------------------------------------------------------------
// 3. Freshness Priority Score
// ---------------------------------------------------------------------------

export function freshnessPriority(p: PageMetrics, trafficMax: number, w: Weights = DEFAULT_WEIGHTS): ScoreResult {
  const used: string[] = [];
  const missing: string[] = [];

  let trafficValue = 0;
  if (p.clicks !== undefined) {
    trafficValue = norm(p.clicks * commercialValueScore(p).value, trafficMax);
    used.push('clicks');
  } else missing.push('clicks');

  const rankingDrop = trackWorsen(p.prevAvgPosition, p.avgPosition, used, missing, 'avg_position');

  let contentAge = 0;
  if (p.monthsSinceUpdate !== undefined) {
    contentAge = clamp01(p.monthsSinceUpdate / w.freshnessAgeHorizonMonths);
    used.push('months_since_update');
  } else missing.push('months_since_update');

  const aiRelevance = pick(p.aiSearchRelevance, used, missing, 'ai_search_relevance');
  const businessImportance = p.businessImportance ?? 0.5;
  if (p.businessImportance !== undefined) used.push('business_importance');

  const value = clamp01((trafficValue + rankingDrop + contentAge + aiRelevance) / 4) * businessImportance;
  const { status, confidence } = resolveDataStatus(used, missing);
  return {
    name: 'freshness_priority',
    value,
    dataStatus: status,
    confidenceFactor: confidence,
    inputsUsed: used,
    inputsMissing: missing,
  };
}

// ---------------------------------------------------------------------------
// 4. Topical Authority  /  5. Entity Coverage  (ratio scores)
// ---------------------------------------------------------------------------

export function topicalAuthority(c: TopicCluster): ScoreResult {
  const value = c.requiredSubtopics <= 0 ? 0 : clamp01(c.coveredSubtopics / c.requiredSubtopics);
  return ratioResult('topical_authority', value, c.requiredSubtopics > 0, 'required_subtopics');
}

export function entityCoverage(e: EntitySet): ScoreResult {
  const value = e.requiredEntities <= 0 ? 0 : clamp01(e.coveredEntities / e.requiredEntities);
  return ratioResult('entity_coverage', value, e.requiredEntities > 0, 'required_entities (SERP/NLP — DATA_REQUIRED)');
}

// ---------------------------------------------------------------------------
// 6. Internal Link Strength
// ---------------------------------------------------------------------------

export function internalLinkStrength(p: PageMetrics, inboundTarget: number, w: Weights = DEFAULT_WEIGHTS): ScoreResult {
  const used: string[] = [];
  const missing: string[] = [];

  let inbound = 0;
  if (p.inboundInternalLinks !== undefined) {
    inbound = norm(p.inboundInternalLinks, inboundTarget);
    used.push('inbound_internal_links');
  } else missing.push('inbound_internal_links');

  const anchor = pick(p.anchorRelevance, used, missing, 'anchor_relevance');

  let depth = 0;
  if (p.clickDepthFromHome !== undefined) {
    depth = invNorm(p.clickDepthFromHome, 5);
    used.push('click_depth_from_home');
  } else missing.push('click_depth_from_home');

  const value = clamp01(w.internalLink.inbound * inbound + w.internalLink.anchor * anchor + w.internalLink.depth * depth);
  const { status, confidence } = resolveDataStatus(used, missing);
  return { name: 'internal_link_strength', value, dataStatus: status, confidenceFactor: confidence, inputsUsed: used, inputsMissing: missing };
}

// ---------------------------------------------------------------------------
// 7. Search Intent Alignment
// ---------------------------------------------------------------------------

const INTENT_PAGE_MATCH: Record<string, number> = {
  'transactional|service': 1,
  'transactional|landing': 1,
  'commercial|service': 1,
  'commercial|service-area': 1,
  'local|service-area': 1,
  'informational|blog': 1,
  'informational|faq': 1,
  'navigational|home': 1,
};

export function intentAlignment(p: PageMetrics): ScoreResult {
  const used: string[] = [];
  const missing: string[] = [];
  if (!p.serpDominantIntent) missing.push('serp_dominant_intent'); else used.push('serp_dominant_intent');
  if (!p.pageType) missing.push('page_type'); else used.push('page_type');

  let value = 0;
  if (p.serpDominantIntent && p.pageType) {
    const key = `${p.serpDominantIntent}|${p.pageType}`;
    value = INTENT_PAGE_MATCH[key] ?? partialIntent(p.serpDominantIntent, p.pageType);
  }
  const { status, confidence } = resolveDataStatus(used, missing);
  return { name: 'intent_alignment', value, dataStatus: status, confidenceFactor: confidence, inputsUsed: used, inputsMissing: missing };
}

function partialIntent(intent: string, page: string): number {
  // related-but-not-ideal pairings score 0.5; outright mismatch 0.
  const related = ['commercial|blog', 'informational|service', 'local|service'];
  return related.includes(`${intent}|${page}`) ? 0.5 : 0;
}

// ---------------------------------------------------------------------------
// 8. GEO / AI-Answer Visibility  (INFERRED by nature)
// ---------------------------------------------------------------------------

export function geoVisibility(g: GeoInputs, w: Weights = DEFAULT_WEIGHTS): ScoreResult {
  const value = clamp01(
    w.geo.citation * clamp01(g.citationLikelihood) +
      w.geo.completeness * clamp01(g.answerCompleteness) +
      w.geo.clarity * clamp01(g.structuredClarity) +
      w.geo.authority * clamp01(g.entityAuthority) +
      w.geo.trust * clamp01(g.sourceTrust),
  );
  return {
    name: 'geo_visibility',
    value,
    dataStatus: 'HYPOTHESIS_FOR_TESTING',
    confidenceFactor: CONFIDENCE_SCORE.INFERRED,
    inputsUsed: ['citation_likelihood', 'answer_completeness', 'structured_clarity', 'entity_authority', 'source_trust'],
    inputsMissing: [],
    note: 'AI Overviews is a separate, undocumented system — this score is INFERRED, never CONFIRMED.',
  };
}

// ---------------------------------------------------------------------------
// 9. E-E-A-T Completeness
// ---------------------------------------------------------------------------

export function eeatCompleteness(e: EeatChecklist): ScoreResult {
  const signals = [
    e.namedAuthor,
    e.authorCredentials,
    e.aboutPage,
    e.externalCitations,
    e.firstPersonExperience,
    e.originalMedia,
    e.lastReviewedDate,
    e.contactNap,
    e.editorialPolicy,
  ];
  const present = signals.filter(Boolean).length;
  const value = present / signals.length;
  return {
    name: 'eeat_completeness',
    value,
    dataStatus: 'VERIFIED',
    confidenceFactor: 1,
    inputsUsed: ['eeat_checklist'],
    inputsMissing: [],
    note: e.isYmyl ? 'YMYL page — weight this higher in impact blend.' : undefined,
  };
}

// ---------------------------------------------------------------------------
// 10. Commercial Value
// ---------------------------------------------------------------------------

export function commercialValueScore(p: PageMetrics): ScoreResult {
  const used: string[] = [];
  const missing: string[] = [];
  const stage = p.funnelStage ? FUNNEL_WEIGHT[p.funnelStage] : 0.5;
  if (p.funnelStage) used.push('funnel_stage'); else missing.push('funnel_stage');
  const margin = p.marginWeight ?? 0.5;
  if (p.marginWeight !== undefined) used.push('margin_weight'); else missing.push('margin_weight');
  const proximity = p.conversionProximity ?? 0.5;
  if (p.conversionProximity !== undefined) used.push('conversion_proximity'); else missing.push('conversion_proximity');

  const value = clamp01(stage * margin * proximity);
  const { status, confidence } = resolveDataStatus(used, missing);
  return { name: 'commercial_value', value, dataStatus: status, confidenceFactor: confidence, inputsUsed: used, inputsMissing: missing };
}

// ---------------------------------------------------------------------------
// 11. Implementation Effort
// ---------------------------------------------------------------------------

export function implementationEffort(size: EffortSize): ScoreResult {
  return {
    name: 'implementation_effort',
    value: EFFORT_WEIGHT[size],
    dataStatus: 'VERIFIED',
    confidenceFactor: 1,
    inputsUsed: ['t_shirt_size'],
    inputsMissing: [],
  };
}

// ---------------------------------------------------------------------------
// 12. Confidence-Adjusted Action Score (the master prioritiser)
// ---------------------------------------------------------------------------

export interface ActionInputs {
  url: string;
  project: string;
  rankingOpportunity: number;
  freshnessPriority: number;
  geoVisibility: number;
  /** confidence of the *claims* this action relies on. */
  claimConfidence: ConfidenceLabel;
  /** 0..1 from the risk register (R-DATA-01/02 etc.). */
  riskScore: number;
  dataStatus: DataStatus;
  effort: EffortSize;
  w?: Weights;
}

export const RISK_BLOCK_THRESHOLD = 0.7;

export function confidenceAdjustedAction(a: ActionInputs): ActionPriority {
  const w = a.w ?? DEFAULT_WEIGHTS;
  const impact = clamp01(
    w.impactBlend.ranking * clamp01(a.rankingOpportunity) +
      w.impactBlend.freshness * clamp01(a.freshnessPriority) +
      w.impactBlend.geo * clamp01(a.geoVisibility),
  );
  const confidence = CONFIDENCE_SCORE[a.claimConfidence];
  const risk = clamp01(a.riskScore);
  const score = (impact * confidence) / Math.max(risk, EPSILON);

  let blockedReason: string | undefined;
  if (risk >= RISK_BLOCK_THRESHOLD) blockedReason = `risk_score ${risk} ≥ ${RISK_BLOCK_THRESHOLD} — route to human gate`;
  else if (a.dataStatus === 'DATA_REQUIRED') blockedReason = 'inputs are placeholders — supply real data before acting';

  return {
    url: a.url,
    project: a.project,
    impactScore: impact,
    confidenceScore: confidence,
    riskScore: risk,
    confidenceAdjustedAction: score,
    dataStatus: a.dataStatus,
    blockedReason,
  };
}

/** Sort a backlog by the master prioritiser, blocked items last. */
export function prioritiseBacklog(actions: ActionPriority[]): ActionPriority[] {
  return [...actions].sort((x, y) => {
    if (!!x.blockedReason !== !!y.blockedReason) return x.blockedReason ? 1 : -1;
    return y.confidenceAdjustedAction - x.confidenceAdjustedAction;
  });
}

// ---------------------------------------------------------------------------
// small internal helpers
// ---------------------------------------------------------------------------

function pick(v: number | undefined, used: string[], missing: string[], name: string): number {
  if (v === undefined) {
    missing.push(name);
    return 0;
  }
  used.push(name);
  return clamp01(v);
}

function trackDrop(prev: number | undefined, curr: number | undefined, used: string[], missing: string[], name: string): number {
  if (prev === undefined || curr === undefined) {
    missing.push(`${name} (period-over-period)`);
    return 0;
  }
  used.push(name);
  return drop(prev, curr);
}

function trackWorsen(prev: number | undefined, curr: number | undefined, used: string[], missing: string[], name: string): number {
  if (prev === undefined || curr === undefined) {
    missing.push(`${name} (period-over-period)`);
    return 0;
  }
  used.push(name);
  return worsening(prev, curr);
}

function ratioResult(name: string, value: number, hasData: boolean, missingName: string): ScoreResult {
  return {
    name,
    value,
    dataStatus: hasData ? 'VERIFIED' : 'DATA_REQUIRED',
    confidenceFactor: hasData ? 1 : 0.1,
    inputsUsed: hasData ? [name] : [],
    inputsMissing: hasData ? [] : [missingName],
  };
}
