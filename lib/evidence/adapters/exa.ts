/**
 * Exa evidence adapter (SYN-MCP-006) — implemented, registered, DORMANT.
 *
 * `available() === !!process.env.EXA_API_KEY` — the key is owner-gated and
 * NOT provisioned yet, so this adapter ships dark. Activation = provision the
 * key; zero code changes.
 *
 * NO NEW DEPENDENCY (bench must_fix `exa-via-fetch`): exa-js is not in
 * package.json and none may be added, so this adapter speaks Exa's REST API
 * with the platform `fetch`:
 *   POST https://api.exa.ai/search    — neural/keyword search (+contents)
 *   POST https://api.exa.ai/contents  — fetch page text for known URLs
 *
 * Exa is the only adapter that reliably returns `publishedDate` — until the
 * key exists, bundles will carry `publishedAt: null` sources and the policy
 * records `ageBasis: 'retrieved'` (see policy.ts).
 */

import { createHash } from 'crypto';
import { logger } from '@/lib/logger';
import { validateExternalUrl } from '@/lib/security/validate-url';
import {
  capExcerpt,
  domainOf,
  RetrieverUnavailableError,
  type SourceEvidence,
} from '../types';
import type { EvidenceRetriever, SearchOptions } from '../retriever';

const PROVIDER = 'exa' as const;
const EXA_BASE_URL = 'https://api.exa.ai';
const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 10;

/** Result item shape shared by Exa /search and /contents responses. */
interface ExaResultItem {
  url?: string;
  title?: string | null;
  publishedDate?: string | null;
  text?: string | null;
  id?: string;
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function toIsoOrNull(value: string | null | undefined): string | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function normalizeItem(item: ExaResultItem): SourceEvidence | null {
  if (!item.url) return null;
  // SSRF hygiene on provider-returned URLs.
  try {
    validateExternalUrl(item.url);
  } catch {
    return null;
  }
  const text = item.text ?? '';
  const excerpt = capExcerpt(text);
  return {
    url: item.url,
    title: item.title ?? '',
    publishedAt: toIsoOrNull(item.publishedDate),
    retrievedAt: new Date().toISOString(),
    provider: PROVIDER,
    contentHash: sha256(
      text.length > 0 ? text : `${item.url}\n${item.title ?? ''}`
    ),
    excerpt,
    domain: domainOf(item.url),
  };
}

async function exaPost(
  path: '/search' | '/contents',
  body: Record<string, unknown>
): Promise<{ results?: ExaResultItem[] }> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new RetrieverUnavailableError(PROVIDER);

  const res = await fetch(`${EXA_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.warn('[evidence:exa] API request failed', {
      path,
      status: res.status,
      detail: detail.slice(0, 500),
    });
    throw new Error(`Exa ${path} failed with status ${res.status}`);
  }

  return (await res.json()) as { results?: ExaResultItem[] };
}

export function createExaRetriever(): EvidenceRetriever {
  return {
    id: PROVIDER,
    capabilities: { canSearch: true, canFetch: true },

    available(): boolean {
      return !!process.env.EXA_API_KEY;
    },

    async search(
      query: string,
      options?: SearchOptions
    ): Promise<SourceEvidence[]> {
      const numResults = Math.min(
        options?.limit ?? DEFAULT_SEARCH_LIMIT,
        MAX_SEARCH_LIMIT
      );
      const data = await exaPost('/search', {
        query,
        numResults,
        contents: { text: true },
      });
      return (data.results ?? [])
        .map(normalizeItem)
        .filter((s): s is SourceEvidence => s !== null);
    },

    async fetch(url: string): Promise<SourceEvidence | null> {
      validateExternalUrl(url); // SSRF boundary (must_fix ssrf-url-hygiene)
      const data = await exaPost('/contents', { urls: [url], text: true });
      const first = (data.results ?? [])[0];
      if (!first) return null;
      return normalizeItem(first);
    },
  };
}
