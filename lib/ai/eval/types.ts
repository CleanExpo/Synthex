/**
 * AI content-generation eval harness — shared types.
 *
 * WS6: a DETERMINISTIC, OFFLINE regression harness for AI-generated content.
 * It does NOT call any real model in CI — a mocked AIProvider returns fixed
 * canned outputs. The scorer applies structural / heuristic / safety checks
 * against per-case expectations so prompt or model regressions surface as a
 * failing jest test rather than as bad content in production.
 *
 * NODE-ONLY: nothing here is reachable from instrumentation.ts / the edge
 * bundle. Keep it that way — do not import this from middleware or edge routes.
 */

/** Platforms the harness understands character / hashtag bounds for. */
export type EvalPlatform =
  | 'twitter'
  | 'linkedin'
  | 'instagram'
  | 'tiktok'
  | 'facebook';

/**
 * Assertable expectations for a single golden case's generated output.
 * Every field is optional — a check is only run when its expectation is set.
 */
export interface CaseExpectations {
  /** Output must be non-empty after trimming. Default true. */
  nonEmpty?: boolean;
  /** Platform whose character / hashtag limits the output must respect. */
  platform?: EvalPlatform;
  /** Minimum trimmed character length. */
  minChars?: number;
  /**
   * Maximum trimmed character length. When omitted but `platform` is set,
   * the platform's maxLength is used.
   */
  maxChars?: number;
  /** Output must parse as JSON and contain these top-level keys. */
  requireJsonKeys?: string[];
  /** Case-insensitive substrings that MUST appear (e.g. brand keyword). */
  mustInclude?: string[];
  /**
   * Case-insensitive substrings that must NOT appear. Merged with the global
   * banned-phrase list (placeholder text, "as an AI", leaked-prompt markers).
   */
  mustNotInclude?: string[];
  /** Maximum number of `#hashtags`. When omitted but `platform` set, uses platform limit. */
  maxHashtags?: number;
}

/** A representative brand/business input paired with its output expectations. */
export interface GoldenCase {
  /** Stable identifier (used in reports + as the mock-output lookup key). */
  id: string;
  /** Human-readable description of what this case exercises. */
  description: string;
  /** Platform the generation targets (drives default bounds). */
  platform: EvalPlatform;
  /** The user-facing brand/business prompt fed to the provider. */
  prompt: string;
  /** What a good output must satisfy. */
  expectations: CaseExpectations;
}

/** Result of one structural / heuristic check. */
export interface CheckResult {
  /** Stable check name, e.g. "maxChars", "no-banned-phrase". */
  name: string;
  passed: boolean;
  /** Human-readable reason — populated on failure. */
  detail?: string;
}

/** Score for a single golden case. */
export interface CaseScore {
  caseId: string;
  /** The output that was scored (canned in CI, real in live mode). */
  output: string;
  checks: CheckResult[];
  /** Count of passed checks. */
  passedChecks: number;
  /** Total checks run. */
  totalChecks: number;
  /** Normalised 0..1 score (passedChecks / totalChecks; 1 when no checks). */
  score: number;
  /** True when every check passed. */
  passed: boolean;
}

/** Aggregate report across all scored cases. */
export interface EvalReport {
  cases: CaseScore[];
  /** Number of fully-passing cases. */
  passedCases: number;
  totalCases: number;
  /** Mean of per-case scores (0..1); 1 when there are no cases. */
  aggregateScore: number;
  /** True when every case fully passed. */
  passed: boolean;
}
