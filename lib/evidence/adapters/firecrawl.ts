/**
 * Firecrawl evidence adapter (SYN-MCP-006).
 *
 * Capabilities: search + fetch. Mirrors the repo's existing Firecrawl usage —
 * env/skip pattern and dynamic import from lib/ai/discover-website.ts, scrape
 * shape from lib/ai/website-analyzer.ts. Uses the EXISTING
 * @mendable/firecrawl-js dependency; no new packages.
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

const PROVIDER = 'firecrawl' as const;
const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 10;

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function getFirecrawl() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new RetrieverUnavailableError(PROVIDER);
  // Dynamic import mirrors discover-website.ts — keeps the SDK out of cold paths.
  const { default: FirecrawlApp } = await import('@mendable/firecrawl-js');
  return new FirecrawlApp({ apiKey });
}

export function createFirecrawlRetriever(): EvidenceRetriever {
  return {
    id: PROVIDER,
    capabilities: { canSearch: true, canFetch: true },

    available(): boolean {
      return !!process.env.FIRECRAWL_API_KEY;
    },

    async search(
      query: string,
      options?: SearchOptions
    ): Promise<SourceEvidence[]> {
      const firecrawl = await getFirecrawl();
      const limit = Math.min(
        options?.limit ?? DEFAULT_SEARCH_LIMIT,
        MAX_SEARCH_LIMIT
      );

      const res = await firecrawl.search(query, {
        limit,
      } as Parameters<typeof firecrawl.search>[1]);

      const web = (res?.web ?? []) as Array<{
        url?: string;
        title?: string;
        description?: string;
      }>;

      const retrievedAt = new Date().toISOString();
      const out: SourceEvidence[] = [];
      for (const r of web) {
        if (!r.url) continue;
        // SSRF hygiene on provider-returned URLs too — never surface a
        // private/loopback/metadata URL as evidence.
        try {
          validateExternalUrl(r.url);
        } catch {
          continue;
        }
        const excerpt = capExcerpt(r.description ?? '');
        out.push({
          url: r.url,
          title: r.title ?? '',
          publishedAt: null, // Firecrawl search results carry no publish date
          retrievedAt,
          provider: PROVIDER,
          contentHash: sha256(`${r.url}\n${r.title ?? ''}\n${excerpt}`),
          excerpt,
          domain: domainOf(r.url),
        });
      }
      return out;
    },

    async fetch(url: string): Promise<SourceEvidence | null> {
      validateExternalUrl(url); // SSRF boundary (must_fix ssrf-url-hygiene)
      const firecrawl = await getFirecrawl();

      // Firecrawl v4 returns a Document directly (throws on failure).
      // TODO(type-safety): same v4 ScrapeParams cast as website-analyzer.ts.
      const doc = await firecrawl.scrape(url, {
        formats: ['markdown'],
      } as Parameters<typeof firecrawl.scrape>[1]);

      if (!doc || !doc.markdown) {
        logger.warn('[evidence:firecrawl] scrape returned empty document', {
          url,
        });
        return null;
      }

      const metadata = (doc.metadata ?? {}) as Record<string, unknown>;
      const publishedRaw =
        (metadata.publishedTime as string | undefined) ??
        (metadata['article:published_time'] as string | undefined) ??
        null;
      const publishedAt =
        publishedRaw && !Number.isNaN(Date.parse(publishedRaw))
          ? new Date(publishedRaw).toISOString()
          : null;

      const excerpt = capExcerpt(doc.markdown);
      return {
        url,
        title: typeof metadata.title === 'string' ? metadata.title : '',
        publishedAt,
        retrievedAt: new Date().toISOString(),
        provider: PROVIDER,
        contentHash: sha256(doc.markdown),
        excerpt,
        domain: domainOf(url),
      };
    },
  };
}
