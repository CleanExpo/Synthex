/**
 * Search-engine sitemap-ping client with in-memory rate limiting.
 *
 * Per SYN-840 acceptance criteria: re-ping rate-limited to 1/hour per
 * target to avoid spamming Google/Bing.
 *
 * State is module-local — for multi-instance deployments this is best-
 * effort (each Node process tracks its own counter). Acceptable trade-
 * off for now; revisit with Redis-backed counter if SYN-834 scales to
 * multiple workers regenerating the same sitemap.
 *
 * @see SYN-840 (parent: SYN-834 epic)
 */

import { logger } from '@/lib/logger';
import type { PingResult, PingTarget } from './types';

const PING_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

const lastPingedAt: Record<PingTarget, number> = {
  google: 0,
  bing: 0,
};

function endpointFor(target: PingTarget, sitemapUrl: string): string {
  const encoded = encodeURIComponent(sitemapUrl);
  switch (target) {
    case 'google':
      return `https://www.google.com/ping?sitemap=${encoded}`;
    case 'bing':
      return `https://www.bing.com/ping?sitemap=${encoded}`;
  }
}

/**
 * Test-only reset hook. Not exported from `index.ts`.
 */
export function _resetPingRateLimitForTests(): void {
  lastPingedAt.google = 0;
  lastPingedAt.bing = 0;
}

/**
 * Test-only override of the "now" clock. Defaults to `Date.now`.
 */
let nowMs: () => number = () => Date.now();
export function _setNowForTests(fn: () => number): void {
  nowMs = fn;
}
export function _resetNowForTests(): void {
  nowMs = () => Date.now();
}

/**
 * Ping a single search engine with the sitemap URL. Honours the 1/hour
 * per-target rate limit. Returns a structured PingResult — never throws
 * for network failures (those become `pinged=false` with a reason).
 */
export async function pingSearchEngine(
  target: PingTarget,
  sitemapUrl: string,
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<PingResult> {
  const attemptedAt = new Date().toISOString();
  if (!sitemapUrl) {
    return {
      target,
      pinged: false,
      reason: 'sitemapUrl required',
      attemptedAt,
    };
  }
  const now = nowMs();
  const elapsed = now - lastPingedAt[target];
  if (elapsed < PING_INTERVAL_MS) {
    const waitMs = PING_INTERVAL_MS - elapsed;
    return {
      target,
      pinged: false,
      reason: `rate-limited — ${Math.ceil(waitMs / 1000)}s until next ping allowed`,
      attemptedAt,
    };
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(endpointFor(target, sitemapUrl), {
      method: 'GET',
    });
    lastPingedAt[target] = now;
    logger.info('[sitemap.ping] sent', {
      target,
      sitemapUrl,
      status: res.status,
    });
    return {
      target,
      pinged: true,
      attemptedAt,
      status: res.status,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.warn('[sitemap.ping] failed', { target, sitemapUrl, reason });
    return {
      target,
      pinged: false,
      reason: `fetch failed: ${reason}`,
      attemptedAt,
    };
  }
}

/**
 * Ping all configured search engines (Google + Bing). Returns one
 * PingResult per target.
 */
export async function pingAllSearchEngines(
  sitemapUrl: string,
  opts: { fetchImpl?: typeof fetch; targets?: readonly PingTarget[] } = {}
): Promise<PingResult[]> {
  const targets = opts.targets ?? (['google', 'bing'] as const);
  return Promise.all(targets.map(t => pingSearchEngine(t, sitemapUrl, opts)));
}
