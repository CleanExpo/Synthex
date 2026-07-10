/**
 * Multi-tenant AI-website generator — public surface.
 *
 * Phase 3 of the AI-Websites product line. Turns a normalised BusinessProfile
 * + brand tokens into a deterministic, on-brand, schema-marked, validator-gated
 * site section. GBP fetch, LLM copy, and deploy compose on top of this core.
 *
 * @see docs/superpowers/specs/2026-07-10-ai-websites-design.md
 */

export { generateSite } from './builder';
export { buildDeterministicCopy } from './template';
export { buildSiteJsonLd } from './jsonld';
export { validateSiteCopy } from './validators';
export { fromGbpLocation, FixtureProfileFetcher } from './profile-fetcher';
export { generateSiteFromSource } from './pipeline';
export type { ProfileFetcher, FromGbpOptions } from './profile-fetcher';
export type { GenerateFromSourceResult } from './pipeline';
export type { ValidateSiteCopyInput } from './validators';
export type { BuildJsonLdInput } from './jsonld';
export type {
  BusinessAddress,
  BusinessFaq,
  BusinessProfile,
  BusinessReview,
  BusinessService,
  GenerateSiteInput,
  GenerateSiteOptions,
  GenerateSiteResult,
  SiteBrand,
  SiteCopy,
  ValidationFinding,
  ValidationSeverity,
} from './types';
