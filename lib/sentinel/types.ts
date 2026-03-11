/**
 * Algorithm Sentinel — Shared Types
 *
 * Type definitions for the Algorithm Sentinel domain:
 * site health monitoring, algorithm update tracking, and alert generation.
 */

// ============================================================================
// CORE WEB VITALS
// ============================================================================

export interface CoreWebVitals {
  lcp: number | null;   // Largest Contentful Paint (seconds)
  inp: number | null;   // Interaction to Next Paint (ms) — replaces FID
  cls: number | null;   // Cumulative Layout Shift (score)
  fid: number | null;   // First Input Delay (ms) — legacy
}

export interface CoreWebVitalsStatus {
  lcp: 'pass' | 'needs-improvement' | 'fail' | 'unknown';
  inp: 'pass' | 'needs-improvement' | 'fail' | 'unknown';
  cls: 'pass' | 'needs-improvement' | 'fail' | 'unknown';
}

// ============================================================================
// SITE HEALTH REPORT
// ============================================================================

export interface SiteHealthReport {
  siteUrl: string;
  userId: string;
  orgId: string;
  avgPosition: number;
  totalClicks: number;
  totalImpressions: number;
  coverageErrors: number;
  coverageWarnings: number;
  coreWebVitals: CoreWebVitals;
  healthScore: number;        // 0–100 computed score
  snapshotDate: Date;
}

// ============================================================================
// ALERT THRESHOLDS
// ============================================================================

export interface AlertThresholds {
  // Position (lower is better — a higher number means drop)
  rankingDropWarning: number;    // default 20%
  rankingDropCritical: number;   // default 50%
  // Clicks
  trafficDropWarning: number;    // default 30%
  trafficDropCritical: number;   // default 60%
  // Crawl errors
  crawlErrorSpikeWarning: number; // default 50%
  // CWV
  lcpThresholdSeconds: number;   // default 3.0 (fail boundary)
  inpThresholdMs: number;        // default 300 (fail boundary)
  clsThreshold: number;          // default 0.25 (fail boundary)
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  rankingDropWarning: 20,
  rankingDropCritical: 50,
  trafficDropWarning: 30,
  trafficDropCritical: 60,
  crawlErrorSpikeWarning: 50,
  lcpThresholdSeconds: 3.0,
  inpThresholdMs: 300,
  clsThreshold: 0.25,
};

// ============================================================================
// ALGORITHM UPDATE INFO (for static feed)
// ============================================================================

export interface AlgorithmUpdateInfo {
  name: string;
  updateType: 'core' | 'spam' | 'helpful-content' | 'product-reviews' | 'link-spam' | 'other';
  announcedAt: Date;
  rolloutStart?: Date;
  rolloutEnd?: Date | null;
  impactLevel: 'high' | 'medium' | 'low';
  description: string;
  sourceUrl?: string;
}

// ============================================================================
// SENTINEL STATUS
// ============================================================================

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertType =
  | 'ranking-drop'
  | 'traffic-drop'
  | 'crawl-error-spike'
  | 'cwv-regression'
  | 'algorithm-update';

export interface SentinelStatus {
  healthScore: number;
  lastChecked: Date | null;
  unacknowledgedAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  activeAlgorithmUpdates: number;
  siteUrl: string | null;
}
