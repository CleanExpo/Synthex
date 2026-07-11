/**
 * Agentic Marketing Intelligence 2026 — shared types.
 *
 * Self-contained (no external deps) so it type-checks standalone.
 * Every scored entity carries a DataStatus + confidence so the system can never
 * present a guess as a measurement.
 */

// ---------------------------------------------------------------------------
// Confidence + data integrity
// ---------------------------------------------------------------------------

/** Reuses the existing Synthex `algorithm-knowledge-base` taxonomy. */
export type ConfidenceLabel =
  | 'CONFIRMED'
  | 'LEAKED'
  | 'INFERRED'
  | 'SPECULATIVE'
  | 'UNVERIFIED'
  | 'OPINION_SOURCE';

/** Maps a confidence label to its 0..1 score used by the prioritiser. */
export const CONFIDENCE_SCORE: Record<ConfidenceLabel, number> = {
  CONFIRMED: 1.0,
  LEAKED: 0.8,
  INFERRED: 0.5,
  SPECULATIVE: 0.25,
  UNVERIFIED: 0.1,
  OPINION_SOURCE: 0.1,
};

/** Whether a score was computed from real data or a placeholder. */
export type DataStatus =
  | 'VERIFIED' // computed from real, sourced inputs
  | 'PARTIAL' // some real inputs, some placeholders
  | 'DATA_REQUIRED' // computed on placeholders — treat as a guess
  | 'HYPOTHESIS_FOR_TESTING'; // plausible, must be A/B tested

export type FunnelStage =
  | 'informational'
  | 'consideration'
  | 'transactional'
  | 'navigational';
export type SearchIntent =
  | 'informational'
  | 'commercial'
  | 'transactional'
  | 'navigational'
  | 'local';
export type PageType =
  | 'blog'
  | 'service'
  | 'service-area'
  | 'home'
  | 'faq'
  | 'landing'
  | 'glossary';
export type EffortSize = 'XS' | 'S' | 'M' | 'L' | 'XL';

// ---------------------------------------------------------------------------
// Claims (from verification ledger)
// ---------------------------------------------------------------------------

export interface RankingClaim {
  id: string;
  claim: string;
  confidence: ConfidenceLabel;
  sources: string[]; // ≥4 for CONFIRMED/LEAKED
  action: string;
  validation: string;
  dataStatus: DataStatus;
}

// ---------------------------------------------------------------------------
// Page-level inputs (mostly DATA_REQUIRED until wired to GSC/Semrush/crawl)
// ---------------------------------------------------------------------------

/** Raw, real metrics for a page over a comparison window. All optional —
 *  absence => DATA_REQUIRED and forces confidenceFactor low. */
export interface PageMetrics {
  url: string;
  project: string; // e.g. 'RestoreAssist'
  // GSC (DATA_REQUIRED until live)
  impressions?: number;
  clicks?: number;
  ctr?: number; // 0..1
  avgPosition?: number; // 1..(100)
  prevImpressions?: number;
  prevClicks?: number;
  prevCtr?: number;
  prevAvgPosition?: number;
  // Semrush / demand (DATA_REQUIRED)
  searchVolume?: number;
  // Content / structural (auditable now via crawl)
  monthsSinceUpdate?: number;
  inboundInternalLinks?: number;
  clickDepthFromHome?: number;
  anchorRelevance?: number; // 0..1
  // Qualitative (LLM/manual rubric, 0..1)
  intentMatch?: number;
  authorityGap?: number;
  competitorGain?: number;
  aiSearchRelevance?: number;
  // Classification
  funnelStage?: FunnelStage;
  pageType?: PageType;
  serpDominantIntent?: SearchIntent;
  // Business
  marginWeight?: number; // 0..1
  conversionProximity?: number; // 0..1
  businessImportance?: number; // 0..1
}

/** GEO / AI-answer visibility inputs (all 0..1, INFERRED by nature). */
export interface GeoInputs {
  citationLikelihood: number;
  answerCompleteness: number;
  structuredClarity: number;
  entityAuthority: number;
  sourceTrust: number;
}

/** E-E-A-T checklist (binary present/absent). */
export interface EeatChecklist {
  namedAuthor: boolean;
  authorCredentials: boolean;
  aboutPage: boolean;
  externalCitations: boolean;
  firstPersonExperience: boolean;
  originalMedia: boolean;
  lastReviewedDate: boolean;
  contactNap: boolean;
  editorialPolicy: boolean;
  isYmyl: boolean;
}

export interface TopicCluster {
  topic: string;
  coveredSubtopics: number;
  requiredSubtopics: number;
}

export interface EntitySet {
  coveredEntities: number;
  requiredEntities: number;
}

// ---------------------------------------------------------------------------
// Score result wrapper — every score is honest about its provenance
// ---------------------------------------------------------------------------

export interface ScoreResult {
  name: string;
  value: number; // 0..1 (or unbounded for ranking_opportunity — see notes)
  dataStatus: DataStatus;
  confidenceFactor: number; // 0..1 — clamped low when dataStatus !== 'VERIFIED'
  inputsUsed: string[];
  inputsMissing: string[];
  note?: string;
}

export interface ActionPriority {
  url: string;
  project: string;
  impactScore: number;
  confidenceScore: number; // from the claim(s) the action relies on
  riskScore: number; // from the risk register
  confidenceAdjustedAction: number; // the master prioritiser value
  dataStatus: DataStatus;
  blockedReason?: string; // set when risk gate or data gate blocks autonomy
}

// ---------------------------------------------------------------------------
// Tunable weights — one object so calibration is auditable (logged decision).
// ---------------------------------------------------------------------------

export interface Weights {
  decay: {
    imp: number;
    clk: number;
    ctr: number;
    pos: number;
    age: number;
    comp: number;
  };
  freshnessAgeHorizonMonths: number;
  internalLink: { inbound: number; anchor: number; depth: number };
  geo: {
    citation: number;
    completeness: number;
    clarity: number;
    authority: number;
    trust: number;
  };
  impactBlend: { ranking: number; freshness: number; geo: number };
}

export const DEFAULT_WEIGHTS: Weights = {
  // decay weights sum to 1.0
  decay: { imp: 0.2, clk: 0.25, ctr: 0.15, pos: 0.2, age: 0.1, comp: 0.1 },
  freshnessAgeHorizonMonths: 18,
  internalLink: { inbound: 0.5, anchor: 0.3, depth: 0.2 },
  geo: {
    citation: 0.25,
    completeness: 0.25,
    clarity: 0.2,
    authority: 0.15,
    trust: 0.15,
  },
  impactBlend: { ranking: 0.5, freshness: 0.3, geo: 0.2 },
};
