/**
 * Humanness Scorer — composite AI-vs-human content quality score
 *
 * Combines slop scanning and voice fingerprinting to produce a single
 * 0–100 score representing how human-like a piece of writing is.
 * Usable as a publishing quality gate.
 *
 * @module lib/quality/humanness-scorer
 */

import { scanForSlop } from '../voice/slop-scanner';
import { extractFingerprint } from '../voice/fingerprint-extractor';
import type { SlopScanResult, VoiceFingerprint } from '../voice/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HumannessResult {
  /** Composite humanness score 0–100. Higher = more human-like. */
  score: number;
  /** Letter grade derived from score. */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Threshold used for pass/fail determination. */
  passThreshold: number;
  /** true if score >= passThreshold */
  passes: boolean;
  /** Breakdown of score components */
  components: {
    /** 0–40 penalty subtracted for slop density and error matches */
    slopPenalty: number;
    /** 0–20 bonus for vocabulary diversity (TTR) */
    ttrBonus: number;
    /** 0–20 bonus for varied sentence rhythm */
    rhythmBonus: number;
    /** 0–20 bonus for Flesch reading ease in natural range */
    readabilityBonus: number;
  };
  /** Raw slop scan output */
  slopScan: SlopScanResult;
  /** Voice fingerprint — only present when text >= 200 words */
  fingerprint?: VoiceFingerprint;
  /** Total word count of analysed text */
  wordCount: number;
  /** Human-readable descriptions of detected problems */
  issues: string[];
  /** Actionable improvement suggestions */
  suggestions: string[];
}

// ---------------------------------------------------------------------------
// Grade mapping
// ---------------------------------------------------------------------------

function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

// ---------------------------------------------------------------------------
// scoreHumanness — main export
// ---------------------------------------------------------------------------

/**
 * Score the humanness of a piece of text.
 *
 * Scoring algorithm:
 * 1. Start at 100
 * 2. Subtract slop penalty: -10 per error match, -4 per warning match, capped at -40
 * 3. If fingerprint available (≥200 words):
 *    - TTR bonus: if ttr > 0.55 +20, if ttr > 0.45 +10
 *    - Rhythm bonus: if sentenceLengths.stdDev > 4 +20, if > 2 +10
 *    - Readability bonus: if fleschReadingEase 30–70 +20, if 20–80 +10
 * 4. Without fingerprint: cap at 85 (signal too uncertain)
 * 5. Clamp to [0, 100]
 *
 * @param text      - Content to analyse
 * @param threshold - Pass/fail threshold (default 60)
 */
export function scoreHumanness(text: string, threshold = 60): HumannessResult {
  const slopScan = scanForSlop(text);
  const fpResult = extractFingerprint(text);
  const wordCount = slopScan.wordCount;

  // 1. Slop penalty: -10 per error, -4 per warning, capped at 40
  const slopPenalty = Math.min(40, slopScan.errorCount * 10 + slopScan.warningCount * 4);
  let score = 100 - slopPenalty;

  let ttrBonus = 0;
  let rhythmBonus = 0;
  let readabilityBonus = 0;
  let fingerprint: VoiceFingerprint | undefined;

  if (fpResult.valid && fpResult.fingerprint) {
    fingerprint = fpResult.fingerprint;
    const fp = fpResult.fingerprint;

    // 2. TTR bonus
    ttrBonus = fp.ttr > 0.55 ? 20 : fp.ttr > 0.45 ? 10 : 0;

    // 3. Rhythm bonus (sentence length variation)
    rhythmBonus = fp.sentenceLengths.stdDev > 4 ? 20 : fp.sentenceLengths.stdDev > 2 ? 10 : 0;

    // 4. Readability bonus (Flesch Reading Ease in natural human range)
    readabilityBonus =
      fp.fleschReadingEase >= 30 && fp.fleschReadingEase <= 70 ? 20
      : fp.fleschReadingEase >= 20 && fp.fleschReadingEase <= 80 ? 10
      : 0;

    score = Math.min(100, Math.max(0, score + ttrBonus + rhythmBonus + readabilityBonus));
  } else {
    // Without a fingerprint we have less signal — cap at 85
    score = Math.min(85, Math.max(0, score));
  }

  const grade = getGrade(score);
  const passes = score >= threshold;

  // ---------------------------------------------------------------------------
  // Issues — human-readable descriptions of detected problems
  // ---------------------------------------------------------------------------
  const issues: string[] = [];

  if (slopScan.errorCount > 0) {
    issues.push(
      `Found ${slopScan.errorCount} high-confidence AI phrase${slopScan.errorCount !== 1 ? 's' : ''} (e.g. delve, robust, leverage)`
    );
  }
  if (slopScan.slopDensity >= 3) {
    issues.push(
      `Slop density ${slopScan.slopDensity.toFixed(1)}/100 words exceeds the error threshold of 3.0`
    );
  }
  if (fingerprint && fingerprint.ttr < 0.40) {
    issues.push(
      `Low vocabulary diversity (TTR ${fingerprint.ttr.toFixed(2)}) — suggests repetitive word choice`
    );
  }
  if (fingerprint && fingerprint.sentenceLengths.stdDev < 2) {
    issues.push(
      `Uniform sentence lengths (std dev ${fingerprint.sentenceLengths.stdDev.toFixed(1)}) — typical of machine-generated text`
    );
  }
  if (fingerprint && fingerprint.fleschReadingEase > 80) {
    issues.push(
      `Readability score ${fingerprint.fleschReadingEase} is unusually high — may indicate oversimplified AI output`
    );
  }

  // ---------------------------------------------------------------------------
  // Suggestions — actionable improvements
  // ---------------------------------------------------------------------------
  const suggestions: string[] = [];

  if (slopScan.errorCount > 0) {
    const topMatches = slopScan.matches.filter((m) => m.severity === 'error').slice(0, 3);
    topMatches.forEach((m) => {
      suggestions.push(
        `Replace "${m.phrase}"${m.suggestion ? ` → ${m.suggestion}` : ' with a more specific alternative'}`
      );
    });
  }
  if (fingerprint && fingerprint.sentenceLengths.stdDev < 2) {
    suggestions.push('Vary sentence length — mix short punchy sentences with longer ones');
  }
  if (fingerprint && fingerprint.ttr < 0.45) {
    suggestions.push('Use synonyms and varied vocabulary to improve word diversity');
  }

  return {
    score,
    grade,
    passThreshold: threshold,
    passes,
    components: { slopPenalty, ttrBonus, rhythmBonus, readabilityBonus },
    slopScan,
    fingerprint,
    wordCount,
    issues,
    suggestions,
  };
}
