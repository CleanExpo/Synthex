/**
 * Themeable, multi-tenant AI-website generator — types.
 *
 * Phase 3 of the AI-Websites product line
 * (docs/superpowers/specs/2026-07-10-ai-websites-design.md). Generalises the
 * DR-only `lib/landing-page` primitive into a BrandConfig-driven builder that
 * produces a deterministic, on-brand, schema-marked site section for ANY
 * portfolio brand from a normalised BusinessProfile.
 *
 * Separation of concerns:
 *   - BrandConfig     → design + voice (colour, tone, forbiddenWords).
 *   - BusinessProfile → the business's FACTUAL data (name, contact, geo,
 *     services, reviews, FAQs) — the normalised shape a Google Business
 *     Profile fetch produces.
 *
 * Live GBP fetch, LLM copy generation, and deploy are OUT of scope here (they
 * need API keys / CEO sign-off). This module ships the deterministic, cred-free
 * core every variant composes with — the same scoping discipline as
 * `lib/landing-page`.
 */

export type ValidationSeverity = 'block' | 'warn';

export interface ValidationFinding {
  rule: string;
  severity: ValidationSeverity;
  message: string;
}

export interface BusinessAddress {
  streetAddress?: string;
  /** Suburb / city. Used in copy, slug, and schema. */
  addressLocality: string;
  /** State, e.g. 'QLD'. */
  addressRegion?: string;
  postalCode?: string;
  /** ISO country code, e.g. 'AU'. */
  addressCountry: string;
}

export interface BusinessService {
  /** Machine slug, e.g. 'water-damage'. */
  slug: string;
  /** Human label used in copy AND schema serviceType, e.g. 'water damage restoration'. */
  label: string;
}

export interface BusinessReview {
  author: string;
  /** 1..5. */
  rating: number;
  text: string;
}

export interface BusinessFaq {
  question: string;
  answer: string;
}

/**
 * Normalised business facts — the shape a Google Business Profile fetch (or a
 * fixture) produces. Distinct from BrandConfig: this is what the business IS,
 * BrandConfig is how the site LOOKS and SOUNDS.
 */
export interface BusinessProfile {
  /** Trading name. */
  name: string;
  /** Registered/legal name (falls back to `name`). */
  legalName?: string;
  /** Canonical site URL, e.g. 'https://acme.com.au'. */
  url: string;
  /** ISO E.164 phone, e.g. '+61730000000'. */
  telephone?: string;
  /** Absolute logo URL (falls back to the brand logo). */
  logoUrl?: string;
  address: BusinessAddress;
  geo?: { lat: number; lng: number };
  /** Services offered; the first is the hero the page targets by default. */
  services: BusinessService[];
  /** Aggregate rating, if known. */
  rating?: { value: number; count: number };
  reviews?: BusinessReview[];
  faqs?: BusinessFaq[];
  /**
   * Factual credentials the business holds, e.g. 'IICRC-certified technicians',
   * 'AS/NZS 4849 compliant'. Rendered as a trust block and emitted as
   * schema.org hasCredential. Brand-agnostic factual data (like reviews) — the
   * business's own credentials, not course/designation branding.
   */
  certifications?: string[];
}

export interface SiteCopy {
  headline: string;
  intro: string;
  bodyParagraphs: string[];
  faqs: BusinessFaq[];
}

export interface GenerateSiteInput {
  /**
   * Brand design + voice tokens. Typed structurally (not against the full
   * BrandConfig) so the generator stays decoupled from the brand-config
   * package's evolving surface — only the fields it reads are named here.
   */
  brand: SiteBrand;
  /** The business's factual profile (normalised GBP output). */
  profile: BusinessProfile;
  /** Target service slug (defaults to `profile.services[0]`). */
  serviceSlug?: string;
}

/** The slice of BrandConfig the generator actually consumes. */
export interface SiteBrand {
  slug: string;
  displayName: string;
  legalName?: string;
  tagline?: string;
  logoPrimary?: string;
  /** Lower-cased words the copy must never contain (brand voice). */
  forbiddenWords: readonly string[];
}

export interface GenerateSiteOptions {
  /** Override canonical base — defaults to `profile.url`. */
  baseUrl?: string;
  /**
   * Caller-supplied copy (e.g. from an LLM). Bypasses the deterministic
   * template but still runs every validator — the AI hook for a later slice.
   */
  copyOverride?: SiteCopy;
  /**
   * 'verified' unlocks category claims ('leading', 'first', ...). Absent or
   * 'directional' blocks them (ACL §18). Mirrors the DR verification gate.
   */
  verificationGateState?: 'directional' | 'verified';
}

export interface GenerateSiteResult {
  /** Service slug, e.g. 'water-damage'. */
  slug: string;
  canonicalUrl: string;
  copy: SiteCopy;
  /** Body HTML (no <html>/<head> wrapper — the Next.js page wraps it). */
  html: string;
  /** schema.org @graph — caller serialises with JSON.stringify. */
  jsonLd: Record<string, unknown>;
  /** All findings; any block-level finding means the caller must reject. */
  validations: ValidationFinding[];
  /** True iff zero block-level findings. */
  ok: boolean;
}

/**
 * Copy that frames AI as the actor (Aid Rule violation) — the human operator is
 * always the actor, AI is a tool. Universal across every AI-website.
 */
export const AI_AS_ACTOR_REGEX =
  /\bAI\s+(restores|cleans|removes|repairs|dries|extracts|treats|inspects|assesses|delivers|provides|performs|conducts|operates|fixes|solves|handles|manages|installs|services)\b/i;

/**
 * Superlative / ranking claims. Under Australian Consumer Law §18 (misleading
 * or deceptive conduct) these need a verified data binding — the generator
 * blocks them unless `verificationGateState === 'verified'`.
 */
export const CATEGORY_CLAIM_REGEX =
  /\b(first|only|leading|number\s*1|no\.?\s*1|biggest|largest|best|top|cheapest|guaranteed)\b/i;
