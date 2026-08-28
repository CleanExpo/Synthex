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
import { logger } from '@/lib/logger';
import type { QualityGateResult } from './types';

// ============================================================================
// QUALITY GATE
// ============================================================================

/**
 * Evaluate content quality and decide routing.
 *
 * IMPORTANT: `contentScorer` is a PURE REGEX heuristic ("no AI calls" by its own
 * header) — it rewards emojis, urgency and power-words, so spam scores ~80. It must
 * NOT be the sole gate that auto-publishes. By default this function can therefore
 * only REJECT (clearly bad) or DRAFT (hold for human review); it never returns
 * 'schedule'.
 *
 * THIS HOTFIX FAILS CLOSED RATHER THAN RE-HOMING THE DECISION. Auto-scheduling is
 * DISABLED here, not moved: content that used to auto-publish off a regex score is
 * now held for a human. That is a deliberate production behaviour change and the
 * correct emergency posture, because the score this gate ran on is a pure-regex
 * heuristic that the generator's own degraded fallback (emoji + urgency + power
 * words) is engineered to max out.
 *
 * Giving the decision to the calibrated LLM judge in lib/ai/content-evaluator, and
 * migrating the four call sites to it, is the follow-up — it needs each caller's
 * ContentBrief threaded through, which is a larger change than a hotfix should
 * carry. An earlier cut of this branch shipped the judge wrapper with no caller
 * wired to it, which read as "the judge owns it now" while actually just
 * disabling the feature (found by independent review, P1). The wrapper is removed
 * rather than left dead, so this branch does one thing and says so.
 *
 * There USED to be an `allowAutoApprove` opt-in here that unlocked a 'schedule'
 * return from the regex score alone. No caller ever passed it — all four call
 * sites relied on the default — but the parameter meant the safety contract this
 * comment describes was enforced by convention rather than by construction, and a
 * future caller passing `true` would auto-publish on a regex score with no judge
 * anywhere in the loop (found by independent review, P1).
 *
 * It is deleted rather than defended: the unsafe decision is now unreachable from
 * this function, so there is no longer a rule for a caller to get wrong.
 *
 * @param content - The generated text content
 * @param platform - Target social platform
 * @param autoApproveThreshold - Reported in the reason; this function never schedules (default 80)
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

  if (score >= minScoreThreshold) {
    return {
      decision: 'draft',
      score,
      reason:
        score >= autoApproveThreshold
          ? `Score ${score} >= ${autoApproveThreshold} (auto bar) — held for review anyway; only the LLM judge may schedule`
          : `Score ${score} >= ${minScoreThreshold} (min) — held for review (regex gate cannot auto-publish; awaiting LLM judge)`,
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
