/**
 * Apify evidence adapter (SYN-MCP-006).
 *
 * Capabilities: FETCH ONLY (bench must_fix `adapter-capability-flags`) —
 * Apify is an actor platform, not a web-search engine; `search()` throws
 * RetrieverCapabilityError. Fetch runs a content-crawler actor against a
 * single URL and normalizes the first dataset item.
 *
 * Reuses the EXISTING runActor pattern (lib/auto-research/apify/client.ts)
 * and the EXISTING apify-client dependency; no new packages.
 */

import { createHash } from 'crypto';
import { logger } from '@/lib/logger';
import { validateExternalUrl } from '@/lib/security/validate-url';
import { runActor } from '@/lib/auto-research/apify/client';
import {
  capExcerpt,
  domainOf,
  RetrieverCapabilityError,
  RetrieverUnavailableError,
  type SourceEvidence,
} from '../types';
import type { EvidenceRetriever, SearchOptions } from '../retriever';

const PROVIDER = 'apify' as const;

/** Default single-URL content actor; override via env without a deploy. */
export const DEFAULT_APIFY_EVIDENCE_ACTOR = 'apify/website-content-crawler';

/** Shape of a website-content-crawler dataset item (fields we consume). */
interface ApifyContentItem {
  url?: string;
  metadata?: { title?: string; publishedAt?: string } | null;
  title?: string;
  text?: string;
  markdown?: string;
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function createApifyRetriever(): EvidenceRetriever {
  return {
    id: PROVIDER,
    capabilities: { canSearch: false, canFetch: true },

    available(): boolean {
      return !!process.env.APIFY_API_TOKEN;
    },

    async search(
      _query: string,
      _options?: SearchOptions
    ): Promise<SourceEvidence[]> {
      // Apify cannot web-search — actors crawl known URLs/platforms.
      throw new RetrieverCapabilityError(PROVIDER, 'canSearch');
    },

    async fetch(url: string): Promise<SourceEvidence | null> {
      validateExternalUrl(url); // SSRF boundary (must_fix ssrf-url-hygiene)
      if (!process.env.APIFY_API_TOKEN) {
        throw new RetrieverUnavailableError(PROVIDER);
      }

      const actorId =
        process.env.EVIDENCE_APIFY_ACTOR_ID || DEFAULT_APIFY_EVIDENCE_ACTOR;

      const items = await runActor<ApifyContentItem>(actorId, {
        startUrls: [{ url }],
        maxCrawlPages: 1,
        maxCrawlDepth: 0,
      });

      const item = items.find(i => typeof (i.text ?? i.markdown) === 'string');
      if (!item) {
        logger.warn('[evidence:apify] actor returned no content items', {
          actorId,
          url,
        });
        return null;
      }

      const content = (item.text ?? item.markdown ?? '') as string;
      const publishedRaw = item.metadata?.publishedAt ?? null;
      const publishedAt =
        publishedRaw && !Number.isNaN(Date.parse(publishedRaw))
          ? new Date(publishedRaw).toISOString()
          : null;

      return {
        url: item.url ?? url,
        title: item.metadata?.title ?? item.title ?? '',
        publishedAt,
        retrievedAt: new Date().toISOString(),
        provider: PROVIDER,
        contentHash: sha256(content),
        excerpt: capExcerpt(content),
        domain: domainOf(item.url ?? url),
      };
    },
  };
}
