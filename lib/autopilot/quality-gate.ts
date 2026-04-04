/**
 * Autopilot Quality Gate
 *
 * @description Score-based routing for AI-generated content.
 * Decides whether content should be auto-scheduled, held as draft
 * for human review, or rejected for regeneration.
 *
 * Thresholds are configurable per-organisation via AutopilotConfig.
 *
 * @module lib/autopilot/quality-gate
 */

import { contentScorer } from '@/lib/ai/content-scorer';
import type { ScoreResult } from '@/lib/ai/content-scorer';
import type { QualityGateResult } from './types';

// ============================================================================
// QUALITY GATE
// ============================================================================

/**
 * Evaluate content quality and decide routing.
 *
 * @param content - The generated text content
 * @param platform - Target social platform
 * @param autoApproveThreshold - Score >= this → auto-schedule (default 80)
 * @param minScoreThreshold - Score >= this → draft for review; below → reject (default 65)
 * @returns Decision + score + reason
 */
export function evaluateContent(
  content: string,
  platform: string,
  autoApproveThreshold = 80,
  minScoreThreshold = 65
): QualityGateResult {
  const result: ScoreResult = contentScorer.score(content, platform);
  const score = result.overall;

  if (score >= autoApproveThreshold) {
    return {
      decision: 'schedule',
      score,
      reason: `Score ${score} >= auto-approve threshold ${autoApproveThreshold}`,
    };
  }

  if (score >= minScoreThreshold) {
    return {
      decision: 'draft',
      score,
      reason: `Score ${score} between ${minScoreThreshold} (min) and ${autoApproveThreshold} (auto) — held for review`,
    };
  }

  return {
    decision: 'reject',
    score,
    reason: `Score ${score} < minimum threshold ${minScoreThreshold} — flagged for regeneration`,
  };
}

/**
 * Get the score dimensions as a flat record (for storage in post metadata).
 */
export function scoreDimensions(
  content: string,
  platform: string
): Record<string, number> {
  const result = contentScorer.score(content, platform);
  return {
    readability: result.dimensions.readability.score,
    engagement: result.dimensions.engagement.score,
    platformFit: result.dimensions.platformFit.score,
    clarity: result.dimensions.clarity.score,
    emotional: result.dimensions.emotional.score,
    writingQuality: result.dimensions.writingQuality.score,
  };
}
