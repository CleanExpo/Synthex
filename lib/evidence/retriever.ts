/**
 * EvidenceRetriever interface + registry (SYN-MCP-006).
 *
 * A retriever wraps one provider behind a uniform contract. Capability flags
 * (bench must_fix `adapter-capability-flags`) make asymmetric providers
 * explicit: Apify is fetch-via-actor only (it cannot web-search), Firecrawl
 * and Exa can both search and fetch.
 *
 * The Exa adapter is REGISTERED but DORMANT: `available()` is
 * `!!process.env.EXA_API_KEY`, so activation is zero code — provision the key.
 *
 * SSRF boundary (bench must_fix `ssrf-url-hygiene`): every adapter calls
 * `assertFetchUrlAllowed()` at the top of `fetch()` — http/https only,
 * localhost / private-IP / link-local / cloud-metadata literals rejected via
 * the repo's canonical guard (lib/security/validate-url.ts). Wave-3 callers
 * will pass user-influenced URLs; the boundary is enforced HERE, not there.
 *
 * CORE ONLY — no imports from app/** or lib/marketing-agency/agent/**.
 */

import { validateExternalUrl } from '@/lib/security/validate-url';
import type { EvidenceProviderId, SourceEvidence } from './types';
import { createFirecrawlRetriever } from './adapters/firecrawl';
import { createApifyRetriever } from './adapters/apify';
import { createExaRetriever } from './adapters/exa';

export { RetrieverCapabilityError, RetrieverUnavailableError } from './types';

export interface RetrieverCapabilities {
  canSearch: boolean;
  canFetch: boolean;
}

export interface SearchOptions {
  /** Maximum results to return (adapters clamp to a sane provider limit). */
  limit?: number;
}

export interface EvidenceRetriever {
  id: EvidenceProviderId;
  capabilities: RetrieverCapabilities;
  /** True when the provider is configured (env key present). Never throws. */
  available(): boolean;
  /** Keyword/neural search → normalized evidence. Throws RetrieverCapabilityError when !canSearch. */
  search(query: string, options?: SearchOptions): Promise<SourceEvidence[]>;
  /** Fetch + normalize a single URL. Returns null when the provider yields no content. */
  fetch(url: string): Promise<SourceEvidence | null>;
}

/**
 * SSRF/protocol boundary for every retriever fetch. Throws on:
 *   - non-http(s) protocols,
 *   - localhost / private / link-local / CGNAT / cloud-metadata IP literals
 *     (including IPv4-mapped IPv6 smuggling).
 */
export function assertFetchUrlAllowed(url: string): void {
  validateExternalUrl(url);
}

/**
 * All registered retrievers, in deterministic order. Exa ships dormant —
 * registered here, activated purely by provisioning EXA_API_KEY.
 */
export function getEvidenceRetrievers(): EvidenceRetriever[] {
  return [
    createFirecrawlRetriever(),
    createApifyRetriever(),
    createExaRetriever(),
  ];
}

/** Only the retrievers whose provider key is configured. */
export function getAvailableRetrievers(): EvidenceRetriever[] {
  return getEvidenceRetrievers().filter(r => r.available());
}
