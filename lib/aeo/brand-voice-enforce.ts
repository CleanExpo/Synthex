/**
 * brand-voice-enforce — mechanical gate (deterministic, NOT subjective).
 *
 * Public entry point: `enforceBrandVoice(input): Promise<BrandVoiceEnforceResult>`.
 *
 * Spec: docs/aeo/brand-voice-enforce-spec-2026-05-16.md
 * Mandate: 27e98e38-a6fd-4269-b223-db00f5e0e629 (Synthex Phase 4 VG-AEO).
 *
 * Hard rules:
 * - No LLM-as-judge. Every rule is a pure function of input + BrandConfig + lookup tables.
 * - Brand isolation: missing brand → throw. Never fall back to another brand.
 * - Tracking is best-effort; gate decision is never blocked by tracking failure.
 */

import { brands } from '@unite-group/brand-config';
import {
  ruleR1,
  ruleR2,
  ruleR3,
  ruleR4,
  ruleR5,
  ruleR6,
  ruleR7,
  ruleR8,
  ruleR9,
  type CanonicalNap,
} from './rules';
import { trackGateRun } from './tracking';
import type {
  BrandVoiceEnforceInput,
  BrandVoiceEnforceResult,
} from './types';

export type {
  BrandVoiceEnforceInput,
  BrandVoiceEnforceResult,
  AeoSurface,
  NapCitation,
  MentionRef,
} from './types';
export { BrandVoiceEnforceError } from './types';

/**
 * Optional dependency-injection seams for the two upstream tables.
 * In production these read from Supabase; in tests they are mocked.
 *
 * Both default to "missing" so the gate never auto-fails when the upstream
 * SYN-824 baselines have not yet populated the tables.
 */
export interface BrandVoiceEnforceDeps {
  lookupCanonicalNap?: (brand: string) => Promise<CanonicalNap | null>;
  lookupMentionFreshness?: (mentionId: string) => Promise<{ lastSeenAt: Date } | null>;
  now?: () => Date;
  /** Allow callers to disable persistence (tests / dry-run). */
  trackingEnabled?: boolean;
}

const DEFAULT_DEPS: Required<BrandVoiceEnforceDeps> = {
  lookupCanonicalNap: async () => null,
  lookupMentionFreshness: async () => null,
  now: () => new Date(),
  trackingEnabled: true,
};

export async function enforceBrandVoice(
  input: BrandVoiceEnforceInput,
  deps: BrandVoiceEnforceDeps = {},
): Promise<BrandVoiceEnforceResult> {
  const merged = { ...DEFAULT_DEPS, ...deps };
  const start = Date.now();

  const brand = brands[input.brand];
  if (!brand) {
    throw new Error(`brand-voice-enforce: unknown brand "${input.brand}" — caller bug`);
  }

  const reasons: string[] = [];
  const evidence: string[] = [];

  // R1
  const r1 = ruleR1(input.candidate, brand);
  if (r1) reasons.push(r1);

  // R2
  const r2 = ruleR2(input.candidate, brand);
  if (r2) reasons.push(r2);

  // R3
  const r3 = ruleR3(input.candidate, input.surface);
  if (r3) reasons.push(r3);

  // R4
  const r4 = ruleR4(input.candidate, brand);
  if (r4.reason) reasons.push(r4.reason);
  if (r4.evidence) evidence.push(r4.evidence);

  // R5
  const r5 = ruleR5(input.candidate, brand);
  if (r5) reasons.push(r5);

  // R6 — VG-AEO-1
  const canonical = input.napCitation
    ? await merged.lookupCanonicalNap(input.brand)
    : null;
  const r6 = ruleR6(input.napCitation, canonical);
  if (r6.reason) reasons.push(r6.reason);
  if (r6.evidence) evidence.push(r6.evidence);

  // R7 — VG-AEO-2
  const freshness = input.mentionRef
    ? await merged.lookupMentionFreshness(input.mentionRef.mentionId)
    : null;
  const r7 = ruleR7(input.mentionRef, freshness, merged.now());
  if (r7.reason) reasons.push(r7.reason);
  if (r7.evidence) evidence.push(r7.evidence);

  // R8
  const r8 = ruleR8(input.candidate, input.surface);
  if (r8) reasons.push(r8);

  // R9
  const r9 = ruleR9(input.surface, input.sourceOfTruthJobId);
  if (r9) reasons.push(r9);

  const result: BrandVoiceEnforceResult = {
    pass: reasons.length === 0,
    reasons,
    evidence_urls: evidence,
    brand: input.brand,
    surface: input.surface,
    durationMs: Date.now() - start,
  };

  if (merged.trackingEnabled) {
    // intentionally not awaited-with-rejection — tracking is best-effort
    void trackGateRun(input, result);
  }

  return result;
}
