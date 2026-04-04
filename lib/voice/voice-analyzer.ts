/**
 * Voice Analyzer — Main Orchestrator
 * Runs fingerprint extraction, slop scan, and optionally writing context building.
 * @module lib/voice/voice-analyzer
 */

import { extractFingerprint } from './fingerprint-extractor';
import { scanForSlop } from './slop-scanner';
import { buildWritingContext } from './context-builder';
import type { VoiceAnalysisResult } from './types';

/**
 * Compute a voice clarity score (0–100) from fingerprint and slop scan results.
 * Higher = cleaner and more distinctive writing.
 */
function computeClarityScore(
  fingerprintValid: boolean,
  slopDensity: number,
  errorCount: number,
  warningCount: number,
  ttr: number = 0
): number {
  if (!fingerprintValid) return 0;

  let score = 100;

  // Deduct for slop density (each point of density = -5 points, max -40)
  score -= Math.min(40, slopDensity * 5);

  // Deduct for error-severity slop matches (each = -5, max -25)
  score -= Math.min(25, errorCount * 5);

  // Deduct for warning-severity slop matches (each = -2, max -15)
  score -= Math.min(15, warningCount * 2);

  // Boost for high type-token ratio (vocabulary diversity)
  if (ttr > 0.6) score += 5;
  else if (ttr < 0.3) score -= 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function analyzeVoice(
  text: string,
  options: { buildContext?: boolean } = {}
): Promise<VoiceAnalysisResult> {
  const fingerprintResult = extractFingerprint(text);
  const slopScan = scanForSlop(text);

  let context;
  if (options.buildContext && fingerprintResult.valid && fingerprintResult.fingerprint) {
    context = buildWritingContext(fingerprintResult.fingerprint);
  }

  const clarityScore = computeClarityScore(
    fingerprintResult.valid,
    slopScan.slopDensity,
    slopScan.errorCount,
    slopScan.warningCount,
    fingerprintResult.valid ? fingerprintResult.fingerprint.ttr : 0
  );

  return {
    fingerprint: fingerprintResult,
    slopScan,
    context,
    clarityScore,
    analysedAt: new Date().toISOString(),
  };
}
