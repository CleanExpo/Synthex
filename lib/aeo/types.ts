/**
 * Public types for the brand-voice-enforce mechanical gate.
 * Spec: docs/aeo/brand-voice-enforce-spec-2026-05-16.md
 */

import type { BrandSlug } from '@unite-group/brand-config';

export type AeoSurface =
  | 'sms'
  | 'outreach'
  | 'landing-page'
  | 'schema-faq'
  | 'gbp-post';

export interface NapCitation {
  businessName: string;
  address?: string;
  phone?: string;
}

export interface MentionRef {
  mentionId: string;
  sourceUrl: string;
}

export interface BrandVoiceEnforceInput {
  brand: BrandSlug;
  candidate: string;
  surface: AeoSurface;
  sourceOfTruthJobId?: string;
  napCitation?: NapCitation;
  mentionRef?: MentionRef;
}

export interface BrandVoiceEnforceResult {
  pass: boolean;
  reasons: string[];
  evidence_urls: string[];
  brand: BrandSlug;
  surface: AeoSurface;
  durationMs: number;
}

/** Thrown by caller-side code when result.pass === false and the caller wants to bubble. */
export class BrandVoiceEnforceError extends Error {
  readonly reasons: string[];
  constructor(reasons: string[]) {
    super(`brand-voice-enforce rejected: ${reasons.join('; ')}`);
    this.name = 'BrandVoiceEnforceError';
    this.reasons = reasons;
  }
}
