/**
 * Pure rule functions R1..R9 for brand-voice-enforce.
 * Each returns null on pass, or a `Rn: <reason>` string on reject.
 * Spec: docs/aeo/brand-voice-enforce-spec-2026-05-16.md §3.
 */

import type { BrandConfig } from '@unite-group/brand-config';
import { FORBIDDEN_PRONOUNS } from '@unite-group/brand-config';
import { fleschKincaidGrade } from './flesch-kincaid';
import type {
  BrandVoiceEnforceInput,
  NapCitation,
  MentionRef,
} from './types';

/** R1 — forbidden-word exact match (case-insensitive, word-boundary). */
export function ruleR1(candidate: string, brand: BrandConfig): string | null {
  for (const word of brand.voice.forbiddenWords ?? []) {
    if (!word) continue;
    const re = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
    if (re.test(candidate)) {
      return `R1: forbidden word "${word}" matched`;
    }
  }
  return null;
}

/** R2 — forbidden-substring match against BrandConfig.doNot (case-insensitive). */
export function ruleR2(candidate: string, brand: BrandConfig): string | null {
  const lower = candidate.toLowerCase();
  for (const phrase of brand.doNot ?? []) {
    if (!phrase) continue;
    if (lower.includes(phrase.toLowerCase())) {
      return `R2: doNot phrase "${phrase}" matched`;
    }
  }
  return null;
}

/** R3 — first-person pronoun ban (exempt for surface=gbp-post). */
export function ruleR3(candidate: string, surface: BrandVoiceEnforceInput['surface']): string | null {
  if (surface === 'gbp-post') return null;
  for (const pronoun of FORBIDDEN_PRONOUNS) {
    const re = new RegExp(`\\b${escapeRegex(pronoun)}\\b`, 'i');
    if (re.test(candidate)) {
      return `R3: first-person pronoun "${pronoun}" matched`;
    }
  }
  return null;
}

/** R4 — reading-level ceiling. Skipped when brand has no pillars.readingLevel. */
export function ruleR4(
  candidate: string,
  brand: BrandConfig,
): { reason: string | null; evidence: string } {
  const hardFail = brand.pillars?.readingLevel?.hardFail;
  if (typeof hardFail !== 'number') {
    return { reason: null, evidence: 'reading_level_unconfigured' };
  }
  const { grade } = fleschKincaidGrade(candidate);
  if (grade > hardFail) {
    return {
      reason: `R4: reading-level grade ${grade} exceeds brand hardFail ${hardFail}`,
      evidence: `reading_level_grade=${grade}`,
    };
  }
  return { reason: null, evidence: `reading_level_grade=${grade}` };
}

const MAX_SENTENCE_WORDS: Record<NonNullable<BrandConfig['voice']['requiredCadence']>, number | null> = {
  short: 18,
  medium: 28,
  long: null,
};

/** R5 — cadence max sentence length. Skipped when requiredCadence unset. */
export function ruleR5(candidate: string, brand: BrandConfig): string | null {
  const cadence = brand.voice.requiredCadence;
  if (!cadence) return null;
  const limit = MAX_SENTENCE_WORDS[cadence];
  if (limit === null) return null;

  const sentences = candidate.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  for (const s of sentences) {
    const wordCount = (s.match(/\b[\p{L}'-]+\b/gu) ?? []).length;
    if (wordCount > limit) {
      return `R5: sentence has ${wordCount} words, cadence "${cadence}" max ${limit}`;
    }
  }
  return null;
}

/**
 * R6 — VG-AEO-1 NAP citation match.
 * Skip-with-evidence when canonical row missing (upstream of SYN-824).
 */
export interface CanonicalNap {
  businessName: string;
  address?: string;
  phone?: string;
}

export function ruleR6(
  napCitation: NapCitation | undefined,
  canonical: CanonicalNap | null,
): { reason: string | null; evidence: string | null } {
  if (!napCitation) return { reason: null, evidence: null };
  if (!canonical) {
    return { reason: null, evidence: 'nap_canonical_missing' };
  }

  const nameMatch =
    napCitation.businessName.trim().toLowerCase() ===
    canonical.businessName.trim().toLowerCase();
  if (!nameMatch) {
    return {
      reason: `R6: NAP business name mismatch ("${napCitation.businessName}" vs canonical "${canonical.businessName}")`,
      evidence: 'nap_canonical',
    };
  }

  if (napCitation.phone && canonical.phone) {
    const a = normalisePhone(napCitation.phone);
    const b = normalisePhone(canonical.phone);
    if (a !== b) {
      return {
        reason: `R6: NAP phone mismatch ("${a}" vs canonical "${b}")`,
        evidence: 'nap_canonical',
      };
    }
  }

  if (napCitation.address && canonical.address) {
    const addrA = napCitation.address.split(/[,\n]/)[0]?.trim().toLowerCase();
    const addrB = canonical.address.split(/[,\n]/)[0]?.trim().toLowerCase();
    if (addrA !== addrB) {
      return {
        reason: `R6: NAP address line 1 mismatch ("${addrA}" vs canonical "${addrB}")`,
        evidence: 'nap_canonical',
      };
    }
  }

  return { reason: null, evidence: 'nap_canonical' };
}

/**
 * R7 — VG-AEO-2 freshness. Reject if mention older than 24h.
 * Skip-with-evidence when freshness row missing.
 */
export function ruleR7(
  mentionRef: MentionRef | undefined,
  freshness: { lastSeenAt: Date } | null,
  now: Date = new Date(),
): { reason: string | null; evidence: string | null } {
  if (!mentionRef) return { reason: null, evidence: null };
  if (!freshness) return { reason: null, evidence: 'mention_unknown' };

  const ageMs = now.getTime() - freshness.lastSeenAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours > 24) {
    return {
      reason: `R7: mention age ${ageHours.toFixed(1)}h exceeds 24h freshness limit`,
      evidence: `mention_age_h=${ageHours.toFixed(1)}`,
    };
  }
  return { reason: null, evidence: `mention_age_h=${ageHours.toFixed(1)}` };
}

const SURFACE_LENGTH_LIMITS: Partial<Record<BrandVoiceEnforceInput['surface'], number>> = {
  sms: 320,
  'gbp-post': 1500,
};

/** R8 — surface-specific length cap. */
export function ruleR8(candidate: string, surface: BrandVoiceEnforceInput['surface']): string | null {
  const limit = SURFACE_LENGTH_LIMITS[surface];
  if (typeof limit !== 'number') return null;
  if (candidate.length > limit) {
    return `R8: surface "${surface}" length ${candidate.length} exceeds ${limit}`;
  }
  return null;
}

/** R9 — source-of-truth job ID required for surface=sms (Q3.2.4 H8). */
export function ruleR9(
  surface: BrandVoiceEnforceInput['surface'],
  sourceOfTruthJobId: string | undefined,
): string | null {
  if (surface === 'sms' && !sourceOfTruthJobId) {
    return 'R9: surface "sms" requires sourceOfTruthJobId per Q3.2.4 H8';
  }
  return null;
}

// ---------- helpers ----------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalisePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}
