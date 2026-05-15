/**
 * Public entry point for the AEO mechanical gates.
 * Spec: docs/aeo/brand-voice-enforce-spec-2026-05-16.md
 */

export {
  enforceBrandVoice,
  type BrandVoiceEnforceDeps,
} from './brand-voice-enforce';

export type {
  BrandVoiceEnforceInput,
  BrandVoiceEnforceResult,
  AeoSurface,
  NapCitation,
  MentionRef,
} from './types';

export { BrandVoiceEnforceError } from './types';
