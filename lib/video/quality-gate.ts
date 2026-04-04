/**
 * Quality Gate — lib/video/quality-gate.ts
 *
 * Aggregated quality checker that runs all validation checks before an
 * episode proceeds to publishing. Integrates four existing quality systems:
 *
 *  1. Humanness scorer  — `scoreHumanness()` ≥ 70  (AI-vs-human voice test)
 *  2. Slop scanner      — `scanForSlop()` matches ≤ 5  (phrase quality)
 *  3. GEO tactic scorer — `scoreTactics()` ≥ 50  (AI search optimisation)
 *  4. FFprobe validator — checks video file codec, resolution, duration
 *
 * Result:
 *   PASS  → episode advances to 'publishing' state
 *   FAIL  → episode moves to 'held' for manual review (never 'failed')
 *
 * The first 5 episodes of each series are ALWAYS held regardless of scores
 * (review gate per the production plan).
 *
 * @task SYN-579
 */

import { spawnSync } from 'child_process';
import { logger } from '@/lib/logger';
import { scoreHumanness } from '@/lib/quality/humanness-scorer';
import { scanForSlop } from '@/lib/voice/slop-scanner';
import { scoreTactics } from '@/lib/geo/tactic-scorer';
import type { GeneratedScript } from './script-generator';

// ── Thresholds ────────────────────────────────────────────────────────────────

export const QUALITY_THRESHOLDS = {
  humanness: 70,
  slopMatchesMax: 5,
  geoTactic: 50,
  minDurationSeconds: 60,
  maxDurationSeconds: 900,
  minWidthPx: 1280,
  minHeightPx: 720,
} as const;

// ── Result types ──────────────────────────────────────────────────────────────

export interface QualityCheckResult {
  pass: boolean;
  /** If false, episode is moved to 'held' not 'failed' */
  reason: 'pass' | 'held-review-gate' | 'held-quality-fail';

  scores: {
    humanness: number;
    slopMatches: number;
    geoTactic: number;
  };

  checks: {
    humanness: CheckDetail;
    slop: CheckDetail;
    geoTactic: CheckDetail;
    video: CheckDetail;
  };

  /** All issues found — shown in the review UI */
  issues: string[];
  /** Actionable suggestions for improvement */
  suggestions: string[];
}

export interface CheckDetail {
  pass: boolean;
  score?: number;
  threshold?: number;
  message: string;
}

// ── FFprobe video validation ──────────────────────────────────────────────────

interface FFprobeResult {
  valid: boolean;
  durationSeconds?: number;
  widthPx?: number;
  heightPx?: number;
  codec?: string;
  error?: string;
}

/**
 * Uses ffprobe (via spawnSync with fixed args — no user input interpolated)
 * to validate the processed video file.
 */
function probeVideo(videoPath: string): FFprobeResult {
  if (!videoPath) {
    return { valid: false, error: 'No video path provided' };
  }

  // Validate path is a string and doesn't contain suspicious characters
  if (typeof videoPath !== 'string' || videoPath.includes('\0')) {
    return { valid: false, error: 'Invalid video path' };
  }

  const result = spawnSync(
    'ffprobe',
    [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_streams',
      '-show_format',
      videoPath,
    ],
    { encoding: 'utf8', timeout: 30_000 }
  );

  if (result.status !== 0 || !result.stdout) {
    return {
      valid: false,
      error: result.stderr?.substring(0, 200) ?? 'ffprobe failed',
    };
  }

  try {
    const probe = JSON.parse(result.stdout) as {
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
      }>;
      format?: { duration?: string };
    };

    const videoStream = probe.streams?.find(s => s.codec_type === 'video');
    const duration = parseFloat(probe.format?.duration ?? '0');

    return {
      valid: true,
      durationSeconds: isNaN(duration) ? 0 : duration,
      widthPx: videoStream?.width,
      heightPx: videoStream?.height,
      codec: videoStream?.codec_name,
    };
  } catch {
    return { valid: false, error: 'Failed to parse ffprobe output' };
  }
}

// ── Individual check functions ────────────────────────────────────────────────

function checkHumanness(voiceover: string): CheckDetail & { score: number } {
  const result = scoreHumanness(voiceover, QUALITY_THRESHOLDS.humanness);

  return {
    pass: result.passes,
    score: result.score,
    threshold: QUALITY_THRESHOLDS.humanness,
    message: result.passes
      ? `Humanness ${result.score}/100 (grade ${result.grade}) — passed`
      : `Humanness ${result.score}/100 (grade ${result.grade}) — below threshold ${QUALITY_THRESHOLDS.humanness}`,
  };
}

function checkSlop(voiceover: string): CheckDetail & { score: number } {
  const result = scanForSlop(voiceover);
  const total = result.totalMatches;
  const pass = total <= QUALITY_THRESHOLDS.slopMatchesMax;

  return {
    pass,
    score: total,
    threshold: QUALITY_THRESHOLDS.slopMatchesMax,
    message: pass
      ? `Slop scan: ${total} matches — passed`
      : `Slop scan: ${total} matches exceeds max ${QUALITY_THRESHOLDS.slopMatchesMax}`,
  };
}

async function checkGeoTactic(
  text: string,
  orgId?: string
): Promise<CheckDetail & { score: number }> {
  try {
    const result = await scoreTactics(text, orgId);
    const score = result.compositeGEOScore;
    const pass = score >= QUALITY_THRESHOLDS.geoTactic;

    return {
      pass,
      score,
      threshold: QUALITY_THRESHOLDS.geoTactic,
      message: pass
        ? `GEO tactic score ${score}/100 — passed`
        : `GEO tactic score ${score}/100 — below threshold ${QUALITY_THRESHOLDS.geoTactic}`,
    };
  } catch (err) {
    logger.warn('QualityGate: GEO tactic scorer failed', {
      error: String(err),
    });
    // Non-blocking — GEO scoring failure doesn't fail the gate
    return {
      pass: true,
      score: 0,
      threshold: QUALITY_THRESHOLDS.geoTactic,
      message: `GEO tactic scorer unavailable — skipped`,
    };
  }
}

function checkVideoFile(videoPath?: string | null): CheckDetail {
  if (!videoPath) {
    return { pass: true, message: 'No video path — skipping video validation' };
  }

  const probe = probeVideo(videoPath);

  if (!probe.valid) {
    return {
      pass: false,
      message: `Video validation failed: ${probe.error}`,
    };
  }

  const issues: string[] = [];

  if (
    probe.durationSeconds !== undefined &&
    probe.durationSeconds < QUALITY_THRESHOLDS.minDurationSeconds
  ) {
    issues.push(
      `Duration ${probe.durationSeconds}s is below minimum ${QUALITY_THRESHOLDS.minDurationSeconds}s`
    );
  }

  if (
    probe.durationSeconds !== undefined &&
    probe.durationSeconds > QUALITY_THRESHOLDS.maxDurationSeconds
  ) {
    issues.push(
      `Duration ${probe.durationSeconds}s exceeds maximum ${QUALITY_THRESHOLDS.maxDurationSeconds}s`
    );
  }

  if (
    probe.widthPx !== undefined &&
    probe.widthPx < QUALITY_THRESHOLDS.minWidthPx
  ) {
    issues.push(
      `Width ${probe.widthPx}px below minimum ${QUALITY_THRESHOLDS.minWidthPx}px`
    );
  }

  if (
    probe.heightPx !== undefined &&
    probe.heightPx < QUALITY_THRESHOLDS.minHeightPx
  ) {
    issues.push(
      `Height ${probe.heightPx}px below minimum ${QUALITY_THRESHOLDS.minHeightPx}px`
    );
  }

  const pass = issues.length === 0;
  return {
    pass,
    message: pass
      ? `Video valid: ${probe.widthPx}x${probe.heightPx} @ ${probe.durationSeconds?.toFixed(1)}s (${probe.codec})`
      : `Video issues: ${issues.join('; ')}`,
  };
}

// ── Main gate function ────────────────────────────────────────────────────────

export interface QualityGateInput {
  /** Full voiceover text from the generated script */
  voiceover: string;
  /** YouTube description — also scored for GEO */
  description: string;
  /** Path to the processed video file (optional at script-only stage) */
  processedVideoPath?: string | null;
  /** Episode number in the series (episodes ≤ 5 are always held) */
  episodeNumber: number;
  /** Optional org ID for personalised GEO weights */
  orgId?: string;
}

/**
 * Run all quality checks and return a pass/fail result.
 *
 * Episodes 1–5 are ALWAYS held for manual review (review gate),
 * regardless of their quality scores.
 */
export async function runQualityGate(
  input: QualityGateInput
): Promise<QualityCheckResult> {
  logger.info('QualityGate: running checks', {
    episodeNumber: input.episodeNumber,
    voiceoverWords: input.voiceover.split(/\s+/).length,
    hasVideo: !!input.processedVideoPath,
  });

  // Run text-based checks in parallel
  const [humanCheck, slopCheck, geoCheck] = await Promise.all([
    Promise.resolve(checkHumanness(input.voiceover)),
    Promise.resolve(checkSlop(input.voiceover)),
    checkGeoTactic(`${input.voiceover}\n\n${input.description}`, input.orgId),
  ]);

  const videoCheck = checkVideoFile(input.processedVideoPath);

  const allIssues: string[] = [];
  const allSuggestions: string[] = [];

  if (!humanCheck.pass) {
    allIssues.push(humanCheck.message);
    allSuggestions.push(
      'Rewrite voiceover sections that sound robotic — vary sentence length and use specific examples'
    );
  }

  if (!slopCheck.pass) {
    allIssues.push(slopCheck.message);
    allSuggestions.push(
      'Remove overused AI phrases — regenerate voiceover with stricter anti-slop prompt'
    );
  }

  if (!geoCheck.pass) {
    allIssues.push(geoCheck.message);
    allSuggestions.push(
      'Add specific statistics, named citations, or attributed quotes to the description'
    );
  }

  if (!videoCheck.pass) {
    allIssues.push(videoCheck.message);
    allSuggestions.push(
      'Re-capture or re-render the video at 1920×1080 minimum resolution'
    );
  }

  const qualityPass = humanCheck.pass && slopCheck.pass && videoCheck.pass;
  // GEO is advisory — a low GEO score warns but doesn't fail the gate

  // Review gate: episodes 1–5 always go to held regardless of quality
  const reviewGateActive = input.episodeNumber <= 5;

  let reason: QualityCheckResult['reason'];
  if (reviewGateActive) {
    reason = 'held-review-gate';
  } else if (!qualityPass) {
    reason = 'held-quality-fail';
  } else {
    reason = 'pass';
  }

  const result: QualityCheckResult = {
    pass: reason === 'pass',
    reason,
    scores: {
      humanness: humanCheck.score,
      slopMatches: slopCheck.score,
      geoTactic: geoCheck.score,
    },
    checks: {
      humanness: humanCheck,
      slop: slopCheck,
      geoTactic: geoCheck,
      video: videoCheck,
    },
    issues: allIssues,
    suggestions: allSuggestions,
  };

  logger.info('QualityGate: result', {
    pass: result.pass,
    reason: result.reason,
    humanness: result.scores.humanness,
    slopMatches: result.scores.slopMatches,
    geoTactic: result.scores.geoTactic,
    issues: allIssues.length,
  });

  return result;
}

/**
 * Extract the voiceover text from a stored GeneratedScript JSON.
 * Handles both direct string and concatenated scene voiceovers.
 */
export function extractVoiceoverFromScript(scriptContent: unknown): string {
  if (!scriptContent || typeof scriptContent !== 'object') return '';

  const script = scriptContent as Partial<GeneratedScript>;

  if (typeof script.voiceover === 'string' && script.voiceover.length > 0) {
    return script.voiceover;
  }

  // Fall back to concatenating scene voiceover texts
  if (Array.isArray(script.scenes)) {
    return script.scenes
      .map(s => (s as { voiceoverText?: string | null }).voiceoverText ?? '')
      .filter(Boolean)
      .join(' ');
  }

  return '';
}
