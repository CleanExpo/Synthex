/**
 * Multi-tenant AI-website generator — public surface.
 *
 * Phase 3 of the AI-Websites product line. Turns a normalised BusinessProfile
 * + brand tokens into a deterministic, on-brand, schema-marked, validator-gated
 * site section. GBP fetch, LLM copy, and deploy compose on top of this core.
 *
 * @see docs/superpowers/specs/2026-07-10-ai-websites-design.md
 */

export { generateSite, resolveHeroService } from './builder';
export { generateSiteWithCopy } from './copywriter';
export { createLlmCopyWriter, SiteCopySchema } from './llm-copywriter';
export { buildDeterministicCopy } from './template';
export { buildSiteJsonLd } from './jsonld';
export { validateSiteCopy } from './validators';
export {
  fromGbpLocation,
  FixtureProfileFetcher,
  createGbpProfileFetcher,
} from './profile-fetcher';
export {
  INDUSTRY_STARTERS,
  getStarter,
  inferStarter,
  applyStarter,
} from './industry-starters';
export type { IndustryStarter } from './industry-starters';
export { SITE_BRAND_PRESETS, getSiteBrandPreset } from './brand-presets';
export { generateSiteFromSource, generateSiteFromGbp } from './pipeline';
export type { GenerateFromGbpOptions } from './pipeline';
export type {
  CopyWriter,
  CopyWriterInput,
  GenerateWithCopyOptions,
} from './copywriter';
export type { LlmCopyWriterDeps } from './llm-copywriter';
export type {
  ProfileFetcher,
  FromGbpOptions,
  GbpClient,
  GbpFetcherOptions,
} from './profile-fetcher';
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
