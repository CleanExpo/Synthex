/**
 * Evidence pipeline core types (SYN-MCP-006).
 *
 * Provider-agnostic source-verification primitives. The trust chain is
 * Exa-independent: every type here works identically whether evidence came
 * from Firecrawl, Apify, or Exa (dormant until EXA_API_KEY is provisioned).
 *
 * CORE ONLY — nothing in lib/evidence/** is imported from app/** or
 * lib/marketing-agency/agent/** in this wave. Wave 3 wires the claims action
 * route + verify-claim job AFTER SYN-MCP-001 merges.
 */

/** Registered retrieval providers. */
export type EvidenceProviderId = 'firecrawl' | 'apify' | 'exa';

/** Stance of one source toward one claim, as judged by an EntailmentScorer. */
export type EvidenceStance =
  | 'supports'
  | 'refutes'
  | 'neutral'
  | 'unverifiable';

/** Aggregate verdict produced by the evidence policy gate. */
export type EvidenceVerdict =
  | 'verified'
  | 'refuted'
  | 'insufficient'
  | 'not_required';

/**
 * Which timestamp the policy used when judging a source's age.
 * `publishedAt: null` is UNKNOWN age — the policy then applies its recency
 * window against `retrievedAt` and records `'retrieved'` here so a
 * "verified without publish dates" bundle is honestly auditable.
 */
export type SourceAgeBasis = 'published' | 'retrieved';

/** One normalized piece of retrieved evidence. */
export interface SourceEvidence {
  /** Canonical URL the evidence was retrieved from. */
  url: string;
  /** Page/document title ('' when the provider returned none). */
  title: string;
  /** ISO-8601 publication date, or null when the provider could not supply one. */
  publishedAt: string | null;
  /** ISO-8601 timestamp of when WE retrieved the content. Always set. */
  retrievedAt: string;
  /** Which adapter produced this evidence. */
  provider: EvidenceProviderId;
  /** sha256 hex digest of the normalized content (url + title + excerpt basis). */
  contentHash: string;
  /** Content excerpt, capped at EXCERPT_MAX_CHARS. Untrusted input — see entailment.ts. */
  excerpt: string;
  /** Optional reference to stored full text (storage key / dataset item id). */
  fullTextRef?: string;
  /** Normalized hostname (lower-case, leading `www.` stripped). */
  domain: string;
}

/** A source plus its entailment judgement against a specific claim. */
export interface ScoredSourceEvidence extends SourceEvidence {
  stance: EvidenceStance;
  /** Scorer confidence in the stance, 0..1. */
  confidence: number;
  /** Identifier of the scorer that produced the judgement (e.g. 'llm-judge-v1'). */
  scorer: string;
  /** Optional scorer rationale (bounded; for audit display only). */
  rationale?: string;
}

/** Aggregate section of an EvidenceBundle — the auditable policy outcome. */
export interface EvidenceAggregate {
  verdict: EvidenceVerdict;
  /** Which policy produced the verdict. */
  policyId: string;
  /** ISO-8601 timestamp of policy evaluation. */
  scoredAt: string;
  /**
   * Honesty fields (bench must_fix `bundle-honesty-fields`): which age basis
   * the policy used per source, and which retrievers were available vs
   * actually used — so "verified without Exa" is visible in the record.
   */
  sourceAgeBasis: Array<{ url: string; basis: SourceAgeBasis }>;
  retrieversAvailable: EvidenceProviderId[];
  retrieversUsed: EvidenceProviderId[];
  /** Human-readable reasons behind a non-verified verdict (empty when verified). */
  reasons: string[];
}

/** Full evidence record for one claim. */
export interface EvidenceBundle {
  claimId: string;
  sources: ScoredSourceEvidence[];
  aggregate: EvidenceAggregate;
}

/** Maximum excerpt length stored + shown to the entailment judge (chars). */
export const EXCERPT_MAX_CHARS = 2000;

/** Normalize a hostname for domain-diversity checks: lower-case, strip `www.`.
 * Deliberately NOT eTLD+1 (would need a public-suffix dep — none allowed);
 * documented limitation: `a.example.com` and `b.example.com` count as distinct. */
export function normalizeDomain(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

/** Extract the normalized domain from a URL ('' when unparseable). */
export function domainOf(url: string): string {
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return '';
  }
}

/** Truncate an excerpt to the storage/judge cap. */
export function capExcerpt(text: string): string {
  return text.length > EXCERPT_MAX_CHARS
    ? text.slice(0, EXCERPT_MAX_CHARS)
    : text;
}

/** Thrown when a capability the adapter does not declare is invoked. */
export class RetrieverCapabilityError extends Error {
  constructor(id: EvidenceProviderId, capability: 'canSearch' | 'canFetch') {
    super(`Retriever '${id}' does not support ${capability}`);
    this.name = 'RetrieverCapabilityError';
  }
}

/** Thrown when a retriever is invoked while unavailable (missing key). */
export class RetrieverUnavailableError extends Error {
  constructor(id: EvidenceProviderId) {
    super(`Retriever '${id}' is not available (provider key not configured)`);
    this.name = 'RetrieverUnavailableError';
  }
}
