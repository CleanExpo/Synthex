/**
 * Onboarding Components Index
 *
 * UNI-1168: Removed dead exports (WebsiteAnalyzer, BusinessDetailsReview,
 * APIKeySetup, OnboardingData type, ReviewedDetails type) — none were
 * imported by any page. Added shared ONBOARDING_STEPS constant to
 * eliminate duplication across the 4 step pages.
 */

// ── Shared constants ────────────────────────────────────────────────
export const ONBOARDING_STEPS = [
  { id: 1, name: 'Your Business' },
  { id: 2, name: 'Platforms' },
  { id: 3, name: 'Persona' },
  { id: 4, name: 'Complete' },
] as const;

// ── Components & hooks ──────────────────────────────────────────────
export { OnboardingProvider, useOnboarding } from './OnboardingContext';
export { ProgressIndicator } from './ProgressIndicator';
export { PlatformConnector } from './PlatformConnector';
export { PersonaSetup } from './PersonaSetup';
