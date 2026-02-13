/**
 * E-E-A-T Engine — Barrel Export
 *
 * Automated E-E-A-T compliance scoring for Google's Quality Rater Guidelines.
 * December 2025 update: E-E-A-T now applies to ALL competitive queries.
 *
 * @module lib/eeat
 */

// Main scorer
export { scoreEEAT } from './eeat-scorer';

// Individual analyzers
export { detectExperience } from './experience-detector';
export { validateExpertise } from './expertise-validator';
export { checkAuthority } from './authority-checker';
export { analyzeTrust } from './trust-analyzer';
export { detectAIContent } from './ai-content-detector';

// Types
export type {
  EEATInput,
  EEATAnalysisResult,
  EEATScore,
  EEATRecommendation,
  ExperienceSignals,
  ExpertiseSignals,
  AuthoritySignals,
  TrustSignals,
  AIDetectionResult,
  FlaggedPhrase,
  ContentType,
  AuthorInfo,
  Credential,
  ScoreTier,
} from './types';

export { getScoreTier } from './types';
