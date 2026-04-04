/**
 * Autonomous A/B Testing & Self-Healing Agent — Types
 *
 * Shared type definitions for the experiments service layer.
 *
 * @module lib/experiments/types
 */

// ============================================================================
// Experiment Types
// ============================================================================

export type ExperimentType =
  | 'title-tag'
  | 'meta-description'
  | 'h1'
  | 'schema'
  | 'content-structure'
  | 'internal-links';

export type MetricToTrack =
  | 'geo-score'
  | 'eeat-score'
  | 'quality-score'
  | 'position'
  | 'clicks';

export type ExperimentStatus =
  | 'draft'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type WinnerVariant = 'original' | 'variant' | 'inconclusive';

// ============================================================================
// Experiment Models
// ============================================================================

export interface ExperimentSuggestion {
  experimentType: ExperimentType;
  title: string;
  hypothesis: string;
  originalValue: string;
  variantValue: string;
  metricToTrack: MetricToTrack;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ExperimentResult {
  experimentId: string;
  winnerVariant: WinnerVariant;
  baselineScore: number;
  variantScore: number;
  improvement: number;
  confidence: 'high' | 'medium' | 'low';
  recommendation: string;
}

// ============================================================================
// Self-Healing Types
// ============================================================================

export type HealingIssueType =
  | 'missing-meta'
  | 'broken-schema'
  | 'low-geo-score'
  | 'low-quality-score'
  | 'missing-entity'
  | 'short-title'
  | 'missing-h1'
  | 'weak-meta-description';

export type HealingSeverity = 'critical' | 'warning';

export interface HealingIssue {
  issueType: HealingIssueType;
  severity: HealingSeverity;
  description: string;
  currentValue?: string;
  suggestedFix: string;
  estimatedImpact: string;
}

// ============================================================================
// Dog-food Report Types
// ============================================================================

export type DogfoodStatus = 'excellent' | 'good' | 'needs-work' | 'unknown';

export interface DogfoodModuleScore {
  module: string;
  score: number;
  benchmark: number;
  status: DogfoodStatus;
  details: string;
  recommendations: string[];
}

export interface DogfoodReport {
  url: string;
  overallScore: number;
  checkedAt: string;
  modules: DogfoodModuleScore[];
  topRecommendations: string[];
  summary: string;
}

// ============================================================================
// Current metrics passed to the experiment designer
// ============================================================================

export interface CurrentMetrics {
  geoScore?: number;
  eeaScore?: number;
  qualityScore?: number;
  title?: string;
  metaDescription?: string;
  h1?: string;
  hasSchema?: boolean;
  entityName?: string;
}
