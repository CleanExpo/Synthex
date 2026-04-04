/**
 * Effect Report Types — SYN-674
 *
 * Shared types for the Synthex Effect Report generation pipeline.
 * Five mandatory sections; each section is conditionally populated
 * based on data availability — omitted entirely rather than placeholder.
 */

// ── Period helpers ─────────────────────────────────────────────────────────────

/** ISO 8601 quarter label, e.g. "2026-Q1" */
export type QuarterPeriod = string;

/** Human-readable quarter label, e.g. "Q1 2026" */
export type QuarterLabel = string;

// ── Section types (each can be null = section omitted) ────────────────────────

/** Section 1: Achievement Summary — always populated */
export interface AchievementSummarySection {
  postsPublished: number;
  estimatedTotalReach: number | null;
  reviewsResponded: number;
  advisorActionsTaken: number;
  consecutiveWeeksActive: number;
}

/** Section 2: Proprietary Metrics Snapshot */
export interface ProprietaryMetricsSection {
  healthScore: number | null;
  healthScoreQoQDelta: number | null;
  geoScore: number | null;
  geoScoreQoQDelta: number | null;
  /** Formatted attribution string, e.g. "$4,200". Null if confidence < 0.80. */
  attributionRoi: string | null;
  attributionQoQDelta: string | null;
}

/** Section 3: Biggest Win — conditional on attribution/post data */
export interface BiggestWinSection {
  date: string; // ISO date string
  postExcerpt: string;
  metric: string; // e.g. "47 website visits"
  isAllTime: boolean;
}

/** Section 4: Honest Gap — lowest Health Score dimension */
export interface HonestGapSection {
  dimensionName: string;
  dimensionScore: number;
  overallScore: number;
  recommendedAction: string;
  deeplinkPath: string; // e.g. "/dashboard/advisor"
}

/** Section 5: What's Next — AI narrative */
export interface WhatsNextSection {
  projection: string; // e.g. "30–45% growth in enquiries in Q2 2026"
  confidenceBasis: string; // e.g. "Based on 12 weeks of posting data"
}

// ── Full report data (stored in effect_reports.report_data JSONB) ─────────────

export interface EffectReportData {
  /** Generation timestamp */
  generatedAt: string;

  /** Display metadata */
  quarterLabel: QuarterLabel;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  businessName: string;
  industry: string;

  /** Sections — null when data unavailable (section omitted from render) */
  achievementSummary: AchievementSummarySection;
  proprietaryMetrics: ProprietaryMetricsSection;
  biggestWin: BiggestWinSection | null;
  honestGap: HonestGapSection | null;
  whatsNext: WhatsNextSection | null;

  /** Which sections were rendered in this report */
  sectionsIncluded: string[];
}

// ── Persisted row shape ───────────────────────────────────────────────────────

export interface EffectReportRow {
  id: string;
  client_id: string;
  period_start: string;
  period_end: string;
  report_data: EffectReportData;
  png_url: string | null;
  pdf_url: string | null;
  pdf_generated_at: string | null;
  email_sent_at: string | null;
  opened_at: string | null;
  created_at: string;
}

// ── Generation input ──────────────────────────────────────────────────────────

export interface GenerateEffectReportInput {
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface GenerateEffectReportOutput {
  reportId: string;
  pngUrl: string;
  reportData: EffectReportData;
}
