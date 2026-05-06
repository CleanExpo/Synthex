/**
 * HERMES voice gate (SYN-912 / HER-1d) — H-1 LOG-ONLY MODE
 *
 * Path D from the resolved Q3 design (see plan blueprint):
 *   - Read ceo-foundation.md + verification-gates.md from .claude/memory/ at
 *     runtime. Both files are in-repo, bundled by Vercel at build time.
 *   - When the foundation files change, HERMES picks up the change on next
 *     deploy automatically. No snapshot drift possible.
 *   - Pass foundation + brand config + draft to Haiku 4.5 with a scoring
 *     prompt. Haiku derives applicable rules and applies them.
 *   - Score = 100 - (failed_rule_count × penalty), clamped 0..100.
 *   - Hard-fail overrides regardless of score: cross-client boundary
 *     violation, universal taboo violation. These categories are explicitly
 *     listed in the prompt.
 *
 * H-1 mode is LOG-ONLY: gate result is recorded on hermes_proposal but the
 * draft is NOT blocked from the Calendar unless a hard-fail override fires.
 * The threshold (70) is informational at H-1, ratcheting to blocking at H-2.
 *
 * Readability layered on top from BrandConfig.pillars.readingLevel:
 *   - pass:  FK grade ≤ tolerance (default 6)
 *   - warn:  tolerance < FK grade ≤ hardFail
 *   - fail:  FK grade > hardFail (default 8) — this IS a blocker even in log-only mode
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { BrandConfig } from '@unite-group/brand-config';
import { routedCall } from '@/lib/ai/model-router';
import { logger } from '@/lib/logger';

const REPO_ROOT = process.cwd();
const CEO_FOUNDATION_PATH = path.join(
  REPO_ROOT,
  '.claude',
  'memory',
  'ceo-foundation.md'
);
const VERIFICATION_GATES_PATH = path.join(
  REPO_ROOT,
  '.claude',
  'memory',
  'verification-gates.md'
);

export type VoiceGateDecision = 'pass' | 'warn' | 'fail';

export interface VoiceGateResult {
  decision: VoiceGateDecision;
  score: number;                 // 0..100
  failedRules: string[];
  reasons: string[];
  readabilityGrade: number;      // Flesch-Kincaid
  readabilityWarning: boolean;   // true when grade is in the warn band
  hardFailOverride: boolean;     // true when a hard-fail rule fired regardless of score
  modelUsed?: string;
}

interface FoundationFiles {
  foundation: string;
  gates: string;
}

let cachedFoundation: FoundationFiles | null = null;

async function loadFoundationFiles(): Promise<FoundationFiles> {
  if (cachedFoundation) return cachedFoundation;
  const [foundation, gates] = await Promise.all([
    fs.readFile(CEO_FOUNDATION_PATH, 'utf8'),
    fs.readFile(VERIFICATION_GATES_PATH, 'utf8'),
  ]);
  cachedFoundation = { foundation, gates };
  return cachedFoundation;
}

// ============================================================================
// Flesch-Kincaid grade level — pure, exported for tests
// ============================================================================

/** Heuristic syllable count for one English word. Minimum 1. */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;

  // Drop silent trailing 'e' (but not 'le' which IS pronounced).
  const trimmed = w.replace(/(?:[^aeiouy]e|e)$/, m =>
    m === 'le' && w.length > 2 ? 'le' : ''
  );

  // Count vowel groups (consecutive vowels = one syllable).
  const groups = trimmed.match(/[aeiouy]+/g) ?? [];
  return Math.max(1, groups.length);
}

/** Flesch-Kincaid grade level. Pure, exported for tests. */
export function fleschKincaidGrade(text: string): number {
  // Sentence boundaries: ., !, ?, or newline pairs.
  const sentences = text
    .split(/[.!?]+|\n\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  const words = text
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0 && /[a-zA-Z]/.test(w));
  if (sentences.length === 0 || words.length === 0) return 0;

  const totalSyllables = words.reduce(
    (sum, w) => sum + countSyllables(w),
    0
  );

  const grade =
    0.39 * (words.length / sentences.length) +
    11.8 * (totalSyllables / words.length) -
    15.59;

  return Math.max(0, parseFloat(grade.toFixed(1)));
}

// ============================================================================
// Gate
// ============================================================================

interface LlmGateResponse {
  failedRules?: string[];
  reasons?: string[];
  hardFailOverride?: boolean;
  totalRulesEvaluated?: number;
}

/**
 * Pure parser for the Haiku gate output. Tolerates code-fence wrapping.
 * Exported for tests.
 */
export function parseLlmGateResponse(raw: string): LlmGateResponse {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const parsed: unknown = JSON.parse(stripped);
  if (!parsed || typeof parsed !== 'object') return {};
  const obj = parsed as Record<string, unknown>;
  return {
    failedRules: Array.isArray(obj.failedRules)
      ? obj.failedRules.filter((r): r is string => typeof r === 'string')
      : [],
    reasons: Array.isArray(obj.reasons)
      ? obj.reasons.filter((r): r is string => typeof r === 'string')
      : [],
    hardFailOverride:
      typeof obj.hardFailOverride === 'boolean' ? obj.hardFailOverride : false,
    totalRulesEvaluated:
      typeof obj.totalRulesEvaluated === 'number' &&
      Number.isFinite(obj.totalRulesEvaluated)
        ? obj.totalRulesEvaluated
        : undefined,
  };
}

/** Compute final decision from raw inputs. Pure, exported for tests. */
export function computeGateDecision(args: {
  failedRuleCount: number;
  totalRules: number;
  hardFailOverride: boolean;
  voiceFloor: number;
  readabilityGrade: number;
  tolerance: number;
  hardFail: number;
}): {
  decision: VoiceGateDecision;
  score: number;
  readabilityWarning: boolean;
} {
  // Penalty per rule = 100 / total rules. Defensive default if total unknown.
  const penalty =
    args.totalRules > 0 ? 100 / args.totalRules : 100 / 10;
  const rawScore = 100 - args.failedRuleCount * penalty;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Readability bands.
  const readabilityFail = args.readabilityGrade > args.hardFail;
  const readabilityWarning =
    args.readabilityGrade > args.tolerance &&
    args.readabilityGrade <= args.hardFail;

  if (args.hardFailOverride || readabilityFail) {
    return { decision: 'fail', score, readabilityWarning };
  }

  if (score < args.voiceFloor || readabilityWarning) {
    return { decision: 'warn', score, readabilityWarning };
  }

  return { decision: 'pass', score, readabilityWarning };
}

/**
 * Run the voice gate on one draft.
 *
 * @param draftContent The proposed post body.
 * @param brand The brand config — supplies pillars.readingLevel + voice/doNot rules.
 * @param voiceFloor Minimum score for pass (70 in H-1, 80 in H-2+).
 */
export async function runVoiceGate(
  draftContent: string,
  brand: BrandConfig,
  voiceFloor: number
): Promise<VoiceGateResult> {
  // Readability is computed locally — no LLM round-trip.
  const readingLevel = brand.pillars?.readingLevel ?? {
    target: 4,
    tolerance: 6,
    hardFail: 8,
  };
  const readabilityGrade = fleschKincaidGrade(draftContent);

  // Foundation-driven rule evaluation via Haiku.
  const { foundation, gates } = await loadFoundationFiles();

  const systemPrompt = `You are a brand-voice rule evaluator. Read the foundation
files below and derive the rules that apply to a draft post. Apply each rule.
Return JSON ONLY (no markdown, no commentary) of shape:

{
  "failedRules": string[],            // short identifier for each failed rule
  "reasons":     string[],            // one-sentence explanation per failure
  "hardFailOverride": boolean,        // true if ANY of these categories fail:
                                       //   - cross-client boundary violation
                                       //   - universal taboo (foundation universal-rules section)
  "totalRulesEvaluated": number       // total rules you derived from the foundation
}

CEO FOUNDATION FILE
===================
${foundation}

VERIFICATION GATES FILE
=======================
${gates}

BRAND-SPECIFIC RULES
====================
Brand: ${brand.displayName} (${brand.slug})
Voice tones (allowed): ${brand.voice.tone.join(', ')}
Voice cadence: ${brand.voice.requiredCadence ?? 'unspecified'}
Forbidden words (case-insensitive): ${brand.voice.forbiddenWords.join(', ')}
Brand pillars: ${brand.pillars?.values.join(', ') ?? 'none specified'}

doNot rules:
${brand.doNot.map(r => `- ${r}`).join('\n')}`;

  const userPrompt = `Evaluate this draft post against the foundation, brand rules, and doNot list above.

DRAFT:
"""
${draftContent}
"""

Return the JSON evaluation now.`;

  const inputTokenEstimate = Math.ceil(
    (systemPrompt.length + userPrompt.length) / 4
  );

  let modelUsed: string | undefined;
  let llmResponse: LlmGateResponse;

  try {
    const raw = await routedCall<string>({
      task: {
        taskType: 'brand_voice_enforcement',
        inputTokenEstimate,
        qualityThreshold: 'high',
        clientId: brand.slug,
        runId: `hermes-gate-${Date.now()}`,
      },
      execute: async (modelId: string) => {
        modelUsed = modelId;
        const { AnthropicProvider } = await import(
          '@/lib/ai/providers/anthropic-provider'
        );
        const provider = new AnthropicProvider();
        const response = await provider.complete({
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1500,
          temperature: 0.1,
        });
        const text = response.choices[0]?.message?.content ?? '';
        if (!text.trim()) throw new Error('Empty gate response');
        return text;
      },
    });
    llmResponse = parseLlmGateResponse(raw);
  } catch (err) {
    // Fail-closed: a missing or invalid gate response is treated as 'fail'
    // with no failed rules listed. The cron operator sees the gate_error in
    // metadata and can investigate. Better to block one draft than ship
    // unvetted content.
    logger.error('[hermes:voice-gate] Gate evaluation failed — failing closed', {
      brandSlug: brand.slug,
      error: String(err),
    });
    return {
      decision: 'fail',
      score: 0,
      failedRules: ['gate_evaluation_failed'],
      reasons: [`Gate LLM call failed: ${String(err)}`],
      readabilityGrade,
      readabilityWarning: false,
      hardFailOverride: true,
      modelUsed,
    };
  }

  const failedRules = llmResponse.failedRules ?? [];
  const reasons = llmResponse.reasons ?? [];
  const hardFailOverride = llmResponse.hardFailOverride ?? false;

  const { decision, score, readabilityWarning } = computeGateDecision({
    failedRuleCount: failedRules.length,
    totalRules: llmResponse.totalRulesEvaluated ?? 10,
    hardFailOverride,
    voiceFloor,
    readabilityGrade,
    tolerance: readingLevel.tolerance,
    hardFail: readingLevel.hardFail,
  });

  return {
    decision,
    score,
    failedRules,
    reasons,
    readabilityGrade,
    readabilityWarning,
    hardFailOverride,
    modelUsed,
  };
}
