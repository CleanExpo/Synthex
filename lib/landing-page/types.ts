/**
 * Per-suburb landing-page generator types.
 *
 * Foundation primitive for SYN-838 — produces the deterministic
 * scaffold (HTML + JSON-LD + audit-trace) for a (serviceCategory ×
 * suburb) landing page on disasterrecovery.com.au.
 *
 * AI-copy generation and the cross-repo deploy are deliberately OUT
 * of scope here — those need CEO/auth sign-off. This module ships
 * the gating primitives every variant will compose with: schema-vs-
 * content match, Aid Rule check, category-claim check, source-of-
 * truth job ID embedding.
 *
 * @see SYN-838 (parent: SYN-834 epic)
 * @see lib/landing-page/README.md
 */

/**
 * Service categories the generator supports. Mirrors the SYN-840
 * sitemap whitelist.
 */
export type DrServiceCategory = 'water-damage' | 'fire' | 'mould';

export const DR_SERVICE_CATEGORIES: readonly DrServiceCategory[] = [
  'water-damage',
  'fire',
  'mould',
] as const;

/**
 * Display-friendly labels for each service category. Used by the
 * deterministic template AND by the schema-vs-content match check.
 */
export const SERVICE_CATEGORY_LABEL: Record<DrServiceCategory, string> = {
  'water-damage': 'water damage restoration',
  fire: 'fire damage restoration',
  mould: 'mould remediation',
};

/**
 * Brand identity for DR. Single instance — no multi-brand support
 * here per the L7 carve-out (DR is the only full-GBP brand).
 */
export interface BrandIdentity {
  name: string;
  legalName: string;
  url: string;
  logoUrl: string;
  /** ISO E.164 phone number, e.g. '+61730000000'. */
  telephone: string;
  /** Geo coordinates of brand HQ — used by JSON-LD `address`/`geo`. */
  hq: { lat: number; lng: number; addressLocality: string };
}

/**
 * Input for {@link buildLandingPage}.
 */
export interface BuildLandingPageInput {
  /** Source-of-truth job ID propagated through the pipeline (Q3.2.4 H8). */
  sourceOfTruthJobId: string;
  /** Service-area coverage row this page is rendered for. */
  serviceAreaCoverageId: string;
  /** Suburb display name (will be slugified for the URL). */
  suburb: string;
  /** AU postcode (used in copy + breadcrumb). */
  postcode: string;
  serviceCategory: DrServiceCategory;
  /** DR brand identity (single instance per L7 carve-out). */
  brand: BrandIdentity;
}

/**
 * Validation finding from a generation gate. `severity: 'block'` is
 * load-bearing — page MUST NOT be committed if any block-level
 * finding is present.
 */
export interface ValidationFinding {
  rule: string;
  severity: 'block' | 'warn';
  message: string;
}

/**
 * Output of {@link buildLandingPage}.
 */
export interface BuildLandingPageResult {
  /** Slug path, e.g. 'water-damage/brisbane-cbd'. NEVER includes a host. */
  slug: string;
  /** Full canonical URL e.g. 'https://disasterrecovery.com.au/water-damage/brisbane-cbd/'. */
  canonicalUrl: string;
  /** HTML body (no <html>/<head> wrapper — Next.js page wraps it). */
  html: string;
  /** JSON-LD object — caller serialises with JSON.stringify. */
  jsonLd: Record<string, unknown>;
  /** All validation findings — block-level findings mean caller must reject. */
  validations: ValidationFinding[];
  /** True iff zero block-level findings. */
  ok: boolean;
}

/**
 * Optional configuration overrides.
 */
export interface BuildLandingPageOptions {
  /** Override the canonical base URL — defaults to `https://disasterrecovery.com.au`. */
  baseUrl?: string;
  /**
   * Optional caller-supplied copy override. If provided, it bypasses
   * the deterministic template — but still passes through the same
   * validators (Aid Rule, category-claim, schema-vs-content match).
   * Use this slot for AI-generated copy in a future ticket.
   */
  copyOverride?: {
    headline: string;
    intro: string;
    bodyParagraphs: string[];
  };
}

/**
 * Phrases that constitute a category claim absent VG-state. Caller
 * must pass `verificationGateState='verified'` to use these in copy.
 *
 * The list is deliberately conservative — false positives are easy
 * to fix, false negatives risk a Cease & Desist letter under ACL
 * §18 (misleading or deceptive conduct).
 */
export const CATEGORY_CLAIM_REGEX =
  /\b(first|only|leading|number\s*1|no\.?\s*1|biggest|largest|best|top)\b/i;

/**
 * Phrases that frame AI as the actor (Aid Rule violation). The
 * generator NEVER produces copy that says "AI restores", "AI
 * removes", "AI cleans", etc — the human restorer is always the
 * actor; AI is a tool.
 */
export const AI_AS_ACTOR_REGEX =
  /\bAI\s+(restores|cleans|removes|repairs|dries|extracts|treats|inspects|assesses|delivers|provides|performs|conducts|operates|fixes|solves|handles|manages)\b/i;
